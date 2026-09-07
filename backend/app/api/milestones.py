import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select

from app.deps import CurrentUser, DbSession, get_project, require_signed_member
from app.models import (
    Deliverable,
    Milestone,
    Project,
    ProjectEvent,
    ProjectMember,
    User,
)
from app.schemas import DeliverableIn, DeliverableOut, MilestoneCreateIn, MilestoneOut
from app.serializers import milestones_out, user_public
from app.services import audit

router = APIRouter(prefix="/api", tags=["milestones"])

ProjectDep = Annotated[Project, Depends(get_project)]


def _get_milestone(db, milestone_id: uuid.UUID) -> tuple[Milestone, Project]:
    milestone = db.get(Milestone, milestone_id)
    if milestone is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "航标不存在")
    project = db.get(Project, milestone.project_id)
    return milestone, project


def _one(db, project_id: uuid.UUID, milestone_id: uuid.UUID) -> MilestoneOut:
    for m in milestones_out(db, project_id):
        if m.id == milestone_id:
            return m
    raise HTTPException(status.HTTP_404_NOT_FOUND, "航标不存在")


@router.get("/projects/{project_id}/milestones", response_model=list[MilestoneOut])
def list_milestones(project: ProjectDep, db: DbSession) -> list[MilestoneOut]:
    return milestones_out(db, project.id)


@router.post(
    "/projects/{project_id}/milestones",
    response_model=MilestoneOut,
    status_code=status.HTTP_201_CREATED,
)
def create_milestone(
    body: MilestoneCreateIn, project: ProjectDep, user: CurrentUser, db: DbSession
) -> MilestoneOut:
    require_signed_member(db, project, user)

    owner_id = None
    if body.owner_handle:
        owner = db.execute(
            select(User).where(func.lower(User.handle) == body.owner_handle.lower())
        ).scalar_one_or_none()
        if owner is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "指定的负责人不存在")
        is_member = db.execute(
            select(ProjectMember.id).where(
                ProjectMember.project_id == project.id,
                ProjectMember.user_id == owner.id,
                ProjectMember.left_at.is_(None),
            )
        ).first()
        if not is_member:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "负责人必须是项目成员")
        owner_id = owner.id

    next_position = db.execute(
        select(func.coalesce(func.max(Milestone.position), -1) + 1).where(
            Milestone.project_id == project.id
        )
    ).scalar_one()

    milestone = Milestone(
        project_id=project.id,
        name=body.name,
        description=body.description,
        stage=body.stage,
        owner_id=owner_id,
        position=next_position,
    )
    db.add(milestone)
    db.flush()
    db.add(
        ProjectEvent(
            project_id=project.id,
            actor_id=user.id,
            kind="milestone_added",
            text=f"新增航标：{milestone.name}",
            tags=["UC-04"],
        )
    )
    audit.record(
        db,
        action="MILESTONE_CREATED",
        object_type="milestone",
        object_id=milestone.id,
        actor_id=user.id,
        project_id=project.id,
        summary=f"{user.handle} 在《{project.title}》新增航标「{milestone.name}」",
    )
    db.commit()
    return _one(db, project.id, milestone.id)


@router.post("/milestones/{milestone_id}/complete", response_model=MilestoneOut)
def complete_milestone(milestone_id: uuid.UUID, user: CurrentUser, db: DbSession) -> MilestoneOut:
    """完成航标。

    这是「谁做成了什么」进入履历的唯一入口——所以它必须记名、留痕，
    并且只有确认了当前版本契约的成员才能做。
    """
    milestone, project = _get_milestone(db, milestone_id)
    require_signed_member(db, project, user)
    if milestone.status == "done":
        raise HTTPException(status.HTTP_409_CONFLICT, "这个航标已经完成了")

    milestone.status = "done"
    milestone.completed_at = datetime.now(UTC)
    milestone.completed_by = user.id
    if milestone.stage:
        project.stage = milestone.stage

    db.add(
        ProjectEvent(
            project_id=project.id,
            actor_id=user.id,
            kind="milestone_completed",
            text=f"航标「{milestone.name}」完成",
            tags=["UC-04"],
        )
    )
    audit.record(
        db,
        action="MILESTONE_COMPLETED",
        object_type="milestone",
        object_id=milestone.id,
        actor_id=user.id,
        project_id=project.id,
        summary=f"{user.handle} 完成《{project.title}》的航标「{milestone.name}」",
        payload={"stage": milestone.stage},
    )
    db.commit()
    return _one(db, project.id, milestone.id)


@router.post("/milestones/{milestone_id}/reopen", response_model=MilestoneOut)
def reopen_milestone(milestone_id: uuid.UUID, user: CurrentUser, db: DbSession) -> MilestoneOut:
    milestone, project = _get_milestone(db, milestone_id)
    require_signed_member(db, project, user)
    if milestone.status != "done":
        raise HTTPException(status.HTTP_409_CONFLICT, "这个航标本来就没完成")

    # 重开航标不会抹掉「谁完成过它」的历史——审计里两条记录都在。
    milestone.status = "open"
    milestone.completed_at = None
    milestone.completed_by = None
    db.add(
        ProjectEvent(
            project_id=project.id,
            actor_id=user.id,
            kind="milestone_reopened",
            text=f"航标「{milestone.name}」被重新打开",
            tags=["UC-04"],
        )
    )
    audit.record(
        db,
        action="MILESTONE_REOPENED",
        object_type="milestone",
        object_id=milestone.id,
        actor_id=user.id,
        project_id=project.id,
        summary=f"{user.handle} 重新打开航标「{milestone.name}」",
    )
    db.commit()
    return _one(db, project.id, milestone.id)


@router.post(
    "/milestones/{milestone_id}/deliverables",
    response_model=DeliverableOut,
    status_code=status.HTTP_201_CREATED,
)
def add_deliverable(
    milestone_id: uuid.UUID, body: DeliverableIn, user: CurrentUser, db: DbSession
) -> DeliverableOut:
    milestone, project = _get_milestone(db, milestone_id)
    require_signed_member(db, project, user)

    deliverable = Deliverable(
        project_id=project.id,
        milestone_id=milestone.id,
        title=body.title,
        kind=body.kind,
        url=body.url,
        note=body.note,
        created_by=user.id,
    )
    db.add(deliverable)
    db.flush()
    db.add(
        ProjectEvent(
            project_id=project.id,
            actor_id=user.id,
            kind="deliverable",
            text=f"{user.display_name} 提交了成果：{body.title}",
            tags=["UC-04"],
        )
    )
    audit.record(
        db,
        action="DELIVERABLE_ADDED",
        object_type="deliverable",
        object_id=deliverable.id,
        actor_id=user.id,
        project_id=project.id,
        summary=f"{user.handle} 在航标「{milestone.name}」下提交成果「{body.title}」",
    )
    db.commit()
    return DeliverableOut(
        id=deliverable.id,
        title=deliverable.title,
        kind=deliverable.kind,
        url=deliverable.url,
        note=deliverable.note,
        created_by=user_public(user),
        created_at=deliverable.created_at,
    )
