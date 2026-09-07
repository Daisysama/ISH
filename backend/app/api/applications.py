import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select

from app.deps import CurrentUser, DbSession, get_membership, get_project, require_owner
from app.models import (
    Application,
    Notification,
    Project,
    ProjectEvent,
    ProjectMember,
    ProjectRole,
    User,
)
from app.schemas import ApplicationCreateIn, ApplicationOut
from app.serializers import application_out
from app.services import audit

router = APIRouter(prefix="/api", tags=["applications"])

ProjectDep = Annotated[Project, Depends(get_project)]


def _get_application(db, application_id: uuid.UUID) -> Application:
    application = db.get(Application, application_id)
    if application is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "申请不存在")
    return application


@router.post(
    "/projects/{project_id}/applications",
    response_model=ApplicationOut,
    status_code=status.HTTP_201_CREATED,
)
def apply_to_project(
    body: ApplicationCreateIn, project: ProjectDep, user: CurrentUser, db: DbSession
) -> ApplicationOut:
    """UC-02 愿同行。"""
    if get_membership(db, project.id, user.id) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "你已经是这个项目的成员了")
    existing = db.execute(
        select(Application).where(
            Application.project_id == project.id,
            Application.applicant_id == user.id,
            Application.status == "pending",
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "你已经提交过申请，正在等待回应")

    application = Application(
        project_id=project.id,
        applicant_id=user.id,
        role=body.role,
        why=body.why,
        time_commitment=body.time_commitment,
        proof=body.proof,
        status="pending",
    )
    db.add(application)
    db.flush()
    db.add(
        Notification(
            user_id=project.owner_id,
            kind="application",
            text=f"{user.display_name} 想以「{body.role}」加入《{project.title}》",
            link=f"/projects/{project.id}",
        )
    )
    audit.record(
        db,
        action="APPLICATION_SUBMITTED",
        object_type="application",
        object_id=application.id,
        actor_id=user.id,
        project_id=project.id,
        summary=f"{user.handle} 申请以「{body.role}」加入《{project.title}》",
    )
    db.commit()
    return application_out(db, application)


@router.get("/projects/{project_id}/applications", response_model=list[ApplicationOut])
def list_applications(project: ProjectDep, user: CurrentUser, db: DbSession) -> list[ApplicationOut]:
    """申请内容只对项目成员可见——申请人写的是给团队看的，不是公开信息。"""
    if get_membership(db, project.id, user.id) is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "只有项目成员可以查看申请")
    rows = (
        db.execute(
            select(Application)
            .where(Application.project_id == project.id)
            .order_by(Application.created_at.desc())
        )
        .scalars()
        .all()
    )
    return [application_out(db, a) for a in rows]


@router.get("/me/applications", response_model=list[ApplicationOut])
def my_applications(user: CurrentUser, db: DbSession) -> list[ApplicationOut]:
    rows = (
        db.execute(
            select(Application)
            .where(Application.applicant_id == user.id)
            .order_by(Application.created_at.desc())
        )
        .scalars()
        .all()
    )
    return [application_out(db, a) for a in rows]


def _decide(
    db, application: Application, user, *, accept: bool
) -> ApplicationOut:
    project = db.get(Project, application.project_id)
    # 越权检查在最前面：不是发起人，连申请存不存在都不该由这个响应告诉你。
    require_owner(db, project, user)
    if application.status != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, f"这条申请已经是 {application.status} 状态")

    application.status = "accepted" if accept else "rejected"
    application.decided_at = datetime.now(UTC)
    application.decided_by = user.id

    if accept:
        db.add(
            ProjectMember(
                project_id=project.id,
                user_id=application.applicant_id,
                role=application.role,
                is_owner=False,
            )
        )
        # 如果申请的角色正好是项目缺的角色，就把这个坑标记为已填。
        role_row = db.execute(
            select(ProjectRole).where(
                ProjectRole.project_id == project.id,
                func.lower(ProjectRole.name) == application.role.lower(),
                ProjectRole.filled_by_user_id.is_(None),
            )
        ).scalar_one_or_none()
        if role_row is not None:
            role_row.filled_by_user_id = application.applicant_id
        applicant = db.get(User, application.applicant_id)
        db.add(
            ProjectEvent(
                project_id=project.id,
                actor_id=user.id,
                kind="member_joined",
                text=f"{applicant.display_name} 以「{application.role}」加入团队",
                tags=["UC-02"],
            )
        )

    db.add(
        Notification(
            user_id=application.applicant_id,
            kind="application_decided",
            text=(
                f"你加入《{project.title}》的申请已通过，下一步请确认项目契约"
                if accept
                else f"《{project.title}》暂时没有接受你的申请"
            ),
            link=f"/projects/{project.id}",
        )
    )
    audit.record(
        db,
        action="APPLICATION_ACCEPTED" if accept else "APPLICATION_REJECTED",
        object_type="application",
        object_id=application.id,
        actor_id=user.id,
        project_id=project.id,
        summary=(
            f"{user.handle} {'接受' if accept else '拒绝'}了一条加入《{project.title}》的申请"
        ),
        payload={"role": application.role},
    )
    db.commit()
    return application_out(db, application)


@router.post("/applications/{application_id}/accept", response_model=ApplicationOut)
def accept_application(
    application_id: uuid.UUID, user: CurrentUser, db: DbSession
) -> ApplicationOut:
    return _decide(db, _get_application(db, application_id), user, accept=True)


@router.post("/applications/{application_id}/reject", response_model=ApplicationOut)
def reject_application(
    application_id: uuid.UUID, user: CurrentUser, db: DbSession
) -> ApplicationOut:
    return _decide(db, _get_application(db, application_id), user, accept=False)


@router.post("/applications/{application_id}/withdraw", response_model=ApplicationOut)
def withdraw_application(
    application_id: uuid.UUID, user: CurrentUser, db: DbSession
) -> ApplicationOut:
    application = _get_application(db, application_id)
    if application.applicant_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "只能撤回自己的申请")
    if application.status != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, "这条申请已经有结果了")
    application.status = "withdrawn"
    application.decided_at = datetime.now(UTC)
    audit.record(
        db,
        action="APPLICATION_WITHDRAWN",
        object_type="application",
        object_id=application.id,
        actor_id=user.id,
        project_id=application.project_id,
        summary=f"{user.handle} 撤回了申请",
    )
    db.commit()
    return application_out(db, application)
