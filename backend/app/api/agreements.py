import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.deps import (
    CurrentUser,
    DbSession,
    OptionalUser,
    current_agreement,
    get_project,
    require_member,
    require_owner,
)
from app.models import (
    Agreement,
    AgreementAcceptance,
    Notification,
    Project,
    ProjectEvent,
    ProjectMember,
)
from app.schemas import AgreementCreateIn, AgreementOut
from app.serializers import agreement_out
from app.services import audit

router = APIRouter(prefix="/api", tags=["agreements"])

ProjectDep = Annotated[Project, Depends(get_project)]


@router.get("/projects/{project_id}/agreement", response_model=AgreementOut)
def read_current_agreement(
    project: ProjectDep, viewer: OptionalUser, db: DbSession
) -> AgreementOut:
    agreement = current_agreement(db, project.id)
    if agreement is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "这个项目还没有契约")
    return agreement_out(db, agreement, viewer)


@router.get("/projects/{project_id}/agreements", response_model=list[AgreementOut])
def agreement_history(
    project: ProjectDep, viewer: OptionalUser, db: DbSession
) -> list[AgreementOut]:
    """历史版本永远可读。改过什么、什么时候改的、谁改的，都不会消失。"""
    rows = (
        db.execute(
            select(Agreement)
            .where(Agreement.project_id == project.id)
            .order_by(Agreement.version.desc())
        )
        .scalars()
        .all()
    )
    return [agreement_out(db, a, viewer) for a in rows]


@router.post(
    "/projects/{project_id}/agreements",
    response_model=AgreementOut,
    status_code=status.HTTP_201_CREATED,
)
def create_agreement_version(
    body: AgreementCreateIn, project: ProjectDep, user: CurrentUser, db: DbSession
) -> AgreementOut:
    """发布新版本契约。

    旧版本不被改写，只被标记 superseded。因为确认是绑定在版本上的，
    新版本一发布，所有人自动回到「未确认」状态——这不是附加规则，是数据模型的必然结果。
    """
    require_owner(db, project, user)
    previous = current_agreement(db, project.id)
    version = (previous.version + 1) if previous else 1
    if previous is not None:
        previous.superseded_at = datetime.now(UTC)

    agreement = Agreement(
        project_id=project.id,
        version=version,
        clauses=[c.model_dump() for c in body.clauses],
        change_note=body.change_note,
        created_by=user.id,
    )
    db.add(agreement)
    db.flush()

    members = (
        db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project.id, ProjectMember.left_at.is_(None)
            )
        )
        .scalars()
        .all()
    )
    for m in members:
        if m.user_id != user.id:
            db.add(
                Notification(
                    user_id=m.user_id,
                    kind="agreement",
                    text=f"《{project.title}》的契约更新到 v{version}，需要你重新确认",
                    link=f"/projects/{project.id}",
                )
            )
    db.add(
        ProjectEvent(
            project_id=project.id,
            actor_id=user.id,
            kind="agreement",
            text=f"契约更新至 v{version}：{body.change_note or '未填写变更说明'}",
            tags=["UC-03"],
        )
    )
    audit.record(
        db,
        action="AGREEMENT_VERSION_CREATED",
        object_type="agreement",
        object_id=agreement.id,
        actor_id=user.id,
        project_id=project.id,
        summary=f"{user.handle} 将《{project.title}》契约更新至 v{version}，全体成员需重新确认",
        payload={
            "version": version,
            "previous_version": previous.version if previous else None,
            "change_note": body.change_note,
            "invalidated_acceptances": len(members),
        },
    )
    db.commit()
    return agreement_out(db, agreement, user)


@router.post("/agreements/{agreement_id}/accept", response_model=AgreementOut)
def accept_agreement(agreement_id: uuid.UUID, user: CurrentUser, db: DbSession) -> AgreementOut:
    agreement = db.get(Agreement, agreement_id)
    if agreement is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "契约不存在")
    project = db.get(Project, agreement.project_id)
    require_member(db, project, user)

    latest = current_agreement(db, project.id)
    if latest is None or latest.id != agreement.id:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"这个版本已经被 v{latest.version if latest else '?'} 取代，请确认最新版本",
        )

    already = db.execute(
        select(AgreementAcceptance).where(
            AgreementAcceptance.agreement_id == agreement.id,
            AgreementAcceptance.user_id == user.id,
        )
    ).scalar_one_or_none()
    if already is None:
        db.add(AgreementAcceptance(agreement_id=agreement.id, user_id=user.id))
        db.add(
            ProjectEvent(
                project_id=project.id,
                actor_id=user.id,
                kind="agreement",
                text=f"{user.display_name} 确认了契约 v{agreement.version}",
                tags=["UC-03"],
            )
        )
        audit.record(
            db,
            action="AGREEMENT_ACCEPTED",
            object_type="agreement",
            object_id=agreement.id,
            actor_id=user.id,
            project_id=project.id,
            summary=f"{user.handle} 确认《{project.title}》契约 v{agreement.version}",
            payload={"version": agreement.version},
        )
        db.commit()
    return agreement_out(db, agreement, user)
