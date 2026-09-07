from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select

from app.deps import (
    CurrentUser,
    DbSession,
    OptionalUser,
    get_project,
    require_owner,
)
from app.models import (
    Agreement,
    AgreementAcceptance,
    Milestone,
    Project,
    ProjectEvent,
    ProjectMember,
    ProjectRole,
)
from app.schemas import (
    HealthOut,
    ProjectCreateIn,
    ProjectDetailOut,
    ProjectEventOut,
    ProjectSummaryOut,
    ProjectUpdateIn,
)
from app.serializers import events_out, project_detail, project_summary, stalled_days
from app.services import audit
from app.services.templates import default_clauses

router = APIRouter(prefix="/api/projects", tags=["projects"])

ProjectDep = Annotated[Project, Depends(get_project)]

STALL_DAYS = 21


@router.get("", response_model=list[ProjectSummaryOut])
def list_projects(
    db: DbSession,
    viewer: OptionalUser,
    q: str | None = None,
    category: str | None = None,
    mode: str | None = None,
    stage: str | None = None,
    need: str | None = None,
    mine: bool = False,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[ProjectSummaryOut]:
    stmt = select(Project).where(Project.is_public.is_(True))
    if mine:
        if viewer is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "需要登录")
        member_projects = select(ProjectMember.project_id).where(
            ProjectMember.user_id == viewer.id, ProjectMember.left_at.is_(None)
        )
        # 自己的项目不受 is_public 限制。
        stmt = select(Project).where(
            or_(Project.id.in_(member_projects), Project.owner_id == viewer.id)
        )
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Project.title).like(like),
                func.lower(Project.summary).like(like),
                func.lower(Project.category).like(like),
            )
        )
    if category:
        stmt = stmt.where(Project.category == category)
    if mode:
        stmt = stmt.where(Project.mode == mode)
    if stage:
        stmt = stmt.where(Project.stage == stage)
    if need:
        role_projects = select(ProjectRole.project_id).where(
            func.lower(ProjectRole.name).like(f"%{need.lower()}%"),
            ProjectRole.filled_by_user_id.is_(None),
        )
        stmt = stmt.where(Project.id.in_(role_projects))

    rows = db.execute(stmt.order_by(Project.created_at.desc()).limit(limit)).scalars().all()
    return [project_summary(db, p) for p in rows]


@router.post("", response_model=ProjectDetailOut, status_code=status.HTTP_201_CREATED)
def create_project(body: ProjectCreateIn, user: CurrentUser, db: DbSession) -> ProjectDetailOut:
    """UC-01 发愿。

    创建项目的同时直接生成 v1 契约草案——不让团队在「先干起来再说」的惯性下跳过立契。
    """
    project = Project(
        title=body.title,
        summary=body.summary,
        category=body.category,
        mode=body.mode,
        duration=body.duration,
        assets=body.assets,
        owner_id=user.id,
        stage="concept",
        is_public=True,
    )
    db.add(project)
    db.flush()

    db.add(
        ProjectMember(
            project_id=project.id, user_id=user.id, role=body.owner_role, is_owner=True
        )
    )
    for name in body.needs:
        db.add(ProjectRole(project_id=project.id, name=name))

    db.add(
        Agreement(
            project_id=project.id,
            version=1,
            clauses=default_clauses(project.title, project.mode),
            change_note="项目创建时生成的初始契约草案",
            created_by=user.id,
        )
    )
    db.add(
        Milestone(
            project_id=project.id,
            name="定义第一个可验证成果",
            description="不写计划书，先想清楚做出什么才算真的开始了。",
            position=0,
            stage="concept",
        )
    )
    db.add(
        ProjectEvent(
            project_id=project.id,
            actor_id=user.id,
            kind="created",
            text=f"{user.display_name} 发起了项目",
            tags=["UC-01"],
        )
    )
    audit.record(
        db,
        action="PROJECT_CREATED",
        object_type="project",
        object_id=project.id,
        actor_id=user.id,
        project_id=project.id,
        summary=f"{user.handle} 发起项目《{project.title}》",
        payload={"mode": project.mode, "needs": body.needs},
    )
    db.commit()
    return project_detail(db, project, user)


@router.get("/{project_id}", response_model=ProjectDetailOut)
def read_project(project: ProjectDep, viewer: OptionalUser, db: DbSession) -> ProjectDetailOut:
    if not project.is_public:
        is_member = viewer is not None and db.execute(
            select(ProjectMember.id).where(
                ProjectMember.project_id == project.id,
                ProjectMember.user_id == viewer.id,
                ProjectMember.left_at.is_(None),
            )
        ).first()
        if not is_member:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "项目不存在")
    return project_detail(db, project, viewer)


@router.patch("/{project_id}", response_model=ProjectDetailOut)
def update_project(
    body: ProjectUpdateIn, project: ProjectDep, user: CurrentUser, db: DbSession
) -> ProjectDetailOut:
    require_owner(db, project, user)
    changed: dict[str, object] = {}
    for field in ("title", "summary", "category", "duration", "assets", "stage", "is_public"):
        value = getattr(body, field)
        if value is not None and value != getattr(project, field):
            changed[field] = value
            setattr(project, field, value)

    if body.needs is not None:
        wanted = [n.strip() for n in body.needs if n.strip()]
        existing = list(
            db.execute(
                select(ProjectRole).where(
                    ProjectRole.project_id == project.id, ProjectRole.filled_by_user_id.is_(None)
                )
            )
            .scalars()
            .all()
        )
        for role in existing:
            if role.name not in wanted:
                db.delete(role)
        have = {r.name for r in existing}
        for name in wanted:
            if name not in have:
                db.add(ProjectRole(project_id=project.id, name=name))
        changed["needs"] = wanted

    if changed:
        db.add(
            ProjectEvent(
                project_id=project.id,
                actor_id=user.id,
                kind="updated",
                text=f"{user.display_name} 更新了项目信息",
                tags=sorted(changed.keys()),
            )
        )
        audit.record(
            db,
            action="PROJECT_UPDATED",
            object_type="project",
            object_id=project.id,
            actor_id=user.id,
            project_id=project.id,
            summary=f"{user.handle} 更新项目《{project.title}》",
            payload={"fields": sorted(changed.keys())},
        )
    db.commit()
    return project_detail(db, project, user)


@router.get("/{project_id}/events", response_model=list[ProjectEventOut])
def project_events(project: ProjectDep, db: DbSession) -> list[ProjectEventOut]:
    return events_out(db, project.id)


@router.get("/{project_id}/health", response_model=HealthOut)
def project_health(project: ProjectDep, db: DbSession) -> HealthOut:
    """UC-04 的停滞提示：不问「你今天干了什么」，只问「这个项目还活着吗」。"""
    days = stalled_days(db, project.id)
    unsigned = 0
    agreement = db.execute(
        select(Agreement)
        .where(Agreement.project_id == project.id)
        .order_by(Agreement.version.desc())
        .limit(1)
    ).scalar_one_or_none()
    if agreement is not None:
        members = db.execute(
            select(func.count())
            .select_from(ProjectMember)
            .where(ProjectMember.project_id == project.id, ProjectMember.left_at.is_(None))
        ).scalar_one()
        signed = db.execute(
            select(func.count())
            .select_from(AgreementAcceptance)
            .where(AgreementAcceptance.agreement_id == agreement.id)
        ).scalar_one()
        unsigned = max(members - signed, 0)

    open_needs = db.execute(
        select(func.count())
        .select_from(ProjectRole)
        .where(ProjectRole.project_id == project.id, ProjectRole.filled_by_user_id.is_(None))
    ).scalar_one()

    stalled = days is not None and days >= STALL_DAYS
    if unsigned:
        hint = f"有 {unsigned} 位成员还没确认当前版本契约，他们暂时无法推进项目。"
    elif stalled and open_needs:
        hint = f"已经 {days} 天没有动静，而且还缺 {open_needs} 个角色。是不是先补人？"
    elif stalled:
        hint = f"已经 {days} 天没有动静。是目标太大，还是该拆一个更小的航标？"
    else:
        hint = "项目在动。"
    return HealthOut(days_since_last_event=days, stalled=stalled, hint=hint)


@router.get("/{project_id}/collaboration-graph")
def collaboration_graph(project: ProjectDep, db: DbSession) -> dict:
    """Collaboration Graph 的最小切片：谁和谁在这个项目里真的一起做过事。"""
    members = list(
        db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project.id, ProjectMember.left_at.is_(None)
            )
        )
        .scalars()
        .all()
    )
    ids = [str(m.user_id) for m in members]
    edges = [
        {"source": a, "target": b}
        for i, a in enumerate(ids)
        for b in ids[i + 1 :]
    ]
    return {"project_id": str(project.id), "nodes": ids, "edges": edges}
