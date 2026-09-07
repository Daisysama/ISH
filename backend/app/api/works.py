import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select

from app.deps import (
    CurrentUser,
    DbSession,
    OptionalUser,
    get_project,
    require_curator,
    require_signed_member,
)
from app.models import (
    Milestone,
    Project,
    ProjectEvent,
    Work,
    WorkCuration,
    WorkTag,
)
from app.schemas import CurationIn, WorkCreateIn, WorkOut
from app.serializers import viewer_taste, work_out
from app.services import audit

router = APIRouter(prefix="/api", tags=["works"])

ProjectDep = Annotated[Project, Depends(get_project)]


@router.post(
    "/projects/{project_id}/works", response_model=WorkOut, status_code=status.HTTP_201_CREATED
)
def publish_work(
    body: WorkCreateIn, project: ProjectDep, user: CurrentUser, db: DbSession
) -> WorkOut:
    """UC-06 成事。

    发布作品要求项目至少完成过一个航标——作品页是执行的结果，不是另一个宣传入口。
    """
    require_signed_member(db, project, user)
    has_done = db.execute(
        select(Milestone.id)
        .where(Milestone.project_id == project.id, Milestone.status == "done")
        .limit(1)
    ).first()
    if not has_done:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "至少完成一个航标之后才能发布作品页"
        )

    work = Work(
        project_id=project.id,
        title=body.title,
        summary=body.summary or project.summary,
        kind=body.kind if body.kind != "其他" else project.category,
        url=body.url,
        published_by=user.id,
    )
    db.add(work)
    db.flush()
    seen: set[str] = set()
    for raw in body.tags:
        tag = raw.strip()
        if tag and tag not in seen:
            seen.add(tag)
            db.add(WorkTag(work_id=work.id, tag=tag, source="self"))

    db.add(
        ProjectEvent(
            project_id=project.id,
            actor_id=user.id,
            kind="work_published",
            text=f"发布公开作品页：{work.title}",
            tags=["UC-06"],
        )
    )
    audit.record(
        db,
        action="WORK_PUBLISHED",
        object_type="work",
        object_id=work.id,
        actor_id=user.id,
        project_id=project.id,
        summary=f"{user.handle} 发布《{project.title}》的作品页「{work.title}」",
        payload={"tags": sorted(seen)},
    )
    db.commit()
    return work_out(db, work, viewer_taste(db, user))


@router.get("/works", response_model=list[WorkOut])
def list_works(
    db: DbSession,
    viewer: OptionalUser,
    kind: str | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[WorkOut]:
    """UC-08 匹配。

    排序只由「编辑标注 + 你的口味」决定。商业关系不参与排序，只参与披露——
    这条规则是 UC-09 的一部分，写在这里而不是运营后台里。
    """
    stmt = select(Work)
    if kind:
        stmt = stmt.where(Work.kind == kind)
    rows = db.execute(stmt.order_by(Work.published_at.desc()).limit(limit)).scalars().all()
    taste = viewer_taste(db, viewer)
    out = [work_out(db, w, taste) for w in rows]
    out.sort(key=lambda w: (-w.match_score, -w.published_at.timestamp()))
    return out


@router.get("/works/{work_id}", response_model=WorkOut)
def read_work(work_id: uuid.UUID, viewer: OptionalUser, db: DbSession) -> WorkOut:
    work = db.get(Work, work_id)
    if work is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "作品不存在")
    return work_out(db, work, viewer_taste(db, viewer))


@router.put("/works/{work_id}/curation", response_model=WorkOut)
def curate_work(
    work_id: uuid.UUID, body: CurationIn, user: CurrentUser, db: DbSession
) -> WorkOut:
    """UC-07 理解作品。

    只有 ISH 编辑能写。项目团队自己不能给自己标「适合谁」——
    否则这层元数据就退化成宣传语。
    """
    require_curator(user)
    work = db.get(Work, work_id)
    if work is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "作品不存在")

    for key, value in body.metrics.items():
        if not 0 <= value <= 100:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, f"指标「{key}」必须在 0-100 之间"
            )

    curation = db.execute(
        select(WorkCuration).where(WorkCuration.work_id == work.id)
    ).scalar_one_or_none()
    previous_relation = curation.commercial_relation if curation else None

    if curation is None:
        curation = WorkCuration(work_id=work.id, curator_id=user.id)
        db.add(curation)
    curation.curator_id = user.id
    curation.fit = body.fit
    curation.avoid = body.avoid
    curation.metrics = dict(body.metrics)
    curation.editorial = body.editorial
    curation.commercial_relation = body.commercial_relation
    curation.audience_tags = [t.strip() for t in body.audience_tags if t.strip()]

    db.query(WorkTag).filter(WorkTag.work_id == work.id, WorkTag.source == "curator").delete(
        synchronize_session=False
    )
    seen: set[str] = set()
    for raw in body.tags:
        tag = raw.strip()
        if tag and tag not in seen:
            seen.add(tag)
            db.add(WorkTag(work_id=work.id, tag=tag, source="curator"))

    audit.record(
        db,
        action="WORK_CURATED",
        object_type="work",
        object_id=work.id,
        actor_id=user.id,
        project_id=work.project_id,
        summary=f"编辑 {user.handle} 更新了「{work.title}」的标注与商业关系披露",
        payload={
            "commercial_relation": body.commercial_relation,
            "previous_commercial_relation": previous_relation,
            "audience_tags": curation.audience_tags,
            "tags": sorted(seen),
        },
    )
    db.commit()
    return work_out(db, work, viewer_taste(db, user))
