"""把 ORM 对象拼成 API 响应。

单独一层是有意的：项目事实（履历、作品署名）必须只能从这里推导出来，
不能有任何一条路径让用户直接写入。
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Agreement,
    AgreementAcceptance,
    Application,
    AuditEvent,
    Deliverable,
    Milestone,
    Project,
    ProjectEvent,
    ProjectMember,
    ProjectRole,
    User,
    UserTaste,
    Work,
    WorkCuration,
    WorkTag,
)
from app.schemas import (
    AcceptanceOut,
    AgreementOut,
    ApplicationOut,
    AuditEventOut,
    CurationOut,
    DeliverableOut,
    DisclosureOut,
    MemberOut,
    MilestoneOut,
    PortfolioOut,
    PortfolioProjectOut,
    ProjectDetailOut,
    ProjectEventOut,
    ProjectSummaryOut,
    UserPublic,
    WorkOut,
    WorkTagOut,
)

RELATION_LABELS = {
    "none": "ISH 与该作品无商业关系",
    "publishing": "ISH 参与该作品发行",
    "paid_promotion": "付费广告合作",
    "equity": "ISH 持有该项目权益",
}


def user_public(user: User) -> UserPublic:
    return UserPublic(
        id=user.id,
        handle=user.handle,
        display_name=user.display_name,
        bio=user.bio,
        skills=list(user.skills or []),
        is_curator=user.is_curator,
        created_at=user.created_at,
    )


def _users_by_id(db: Session, ids: set[uuid.UUID]) -> dict[uuid.UUID, User]:
    ids = {i for i in ids if i}
    if not ids:
        return {}
    rows = db.execute(select(User).where(User.id.in_(ids))).scalars().all()
    return {u.id: u for u in rows}


def current_agreement_row(db: Session, project_id: uuid.UUID) -> Agreement | None:
    return db.execute(
        select(Agreement)
        .where(Agreement.project_id == project_id)
        .order_by(Agreement.version.desc())
        .limit(1)
    ).scalar_one_or_none()


def _signed_user_ids(db: Session, agreement: Agreement | None) -> set[uuid.UUID]:
    if agreement is None:
        return set()
    rows = db.execute(
        select(AgreementAcceptance.user_id).where(
            AgreementAcceptance.agreement_id == agreement.id
        )
    ).scalars().all()
    return set(rows)


def project_needs(db: Session, project_id: uuid.UUID) -> list[str]:
    rows = db.execute(
        select(ProjectRole.name).where(
            ProjectRole.project_id == project_id, ProjectRole.filled_by_user_id.is_(None)
        )
    ).scalars().all()
    return list(rows)


def _milestone_counts(db: Session, project_id: uuid.UUID) -> tuple[int, int]:
    total = db.execute(
        select(func.count()).select_from(Milestone).where(Milestone.project_id == project_id)
    ).scalar_one()
    done = db.execute(
        select(func.count())
        .select_from(Milestone)
        .where(Milestone.project_id == project_id, Milestone.status == "done")
    ).scalar_one()
    return done, total


def member_rows(db: Session, project_id: uuid.UUID) -> list[ProjectMember]:
    return list(
        db.execute(
            select(ProjectMember)
            .where(ProjectMember.project_id == project_id, ProjectMember.left_at.is_(None))
            .order_by(ProjectMember.is_owner.desc(), ProjectMember.joined_at.asc())
        )
        .scalars()
        .all()
    )


def members_out(db: Session, project_id: uuid.UUID) -> list[MemberOut]:
    rows = member_rows(db, project_id)
    users = _users_by_id(db, {m.user_id for m in rows})
    signed = _signed_user_ids(db, current_agreement_row(db, project_id))
    return [
        MemberOut(
            user=user_public(users[m.user_id]),
            role=m.role,
            is_owner=m.is_owner,
            joined_at=m.joined_at,
            agreement_signed=m.user_id in signed,
        )
        for m in rows
        if m.user_id in users
    ]


def project_summary(db: Session, project: Project) -> ProjectSummaryOut:
    done, total = _milestone_counts(db, project.id)
    agreement = current_agreement_row(db, project.id)
    member_count = db.execute(
        select(func.count())
        .select_from(ProjectMember)
        .where(ProjectMember.project_id == project.id, ProjectMember.left_at.is_(None))
    ).scalar_one()
    has_work = (
        db.execute(select(Work.id).where(Work.project_id == project.id).limit(1)).first()
        is not None
    )
    owner = db.get(User, project.owner_id)
    return ProjectSummaryOut(
        id=project.id,
        title=project.title,
        summary=project.summary,
        category=project.category,
        mode=project.mode,
        duration=project.duration,
        stage=project.stage,
        is_public=project.is_public,
        created_at=project.created_at,
        owner=user_public(owner),
        needs=project_needs(db, project.id),
        member_count=member_count,
        milestones_done=done,
        milestones_total=total,
        agreement_version=agreement.version if agreement else None,
        has_work=has_work,
    )


def project_detail(db: Session, project: Project, viewer: User | None) -> ProjectDetailOut:
    base = project_summary(db, project)
    members = members_out(db, project.id)
    viewer_member = next((m for m in members if viewer and m.user.id == viewer.id), None)
    pending_count = db.execute(
        select(func.count())
        .select_from(Application)
        .where(Application.project_id == project.id, Application.status == "pending")
    ).scalar_one()
    viewer_pending = False
    if viewer is not None:
        viewer_pending = (
            db.execute(
                select(Application.id).where(
                    Application.project_id == project.id,
                    Application.applicant_id == viewer.id,
                    Application.status == "pending",
                )
            ).first()
            is not None
        )
    return ProjectDetailOut(
        **base.model_dump(),
        assets=project.assets,
        members=members,
        viewer_is_member=viewer_member is not None,
        viewer_is_owner=viewer is not None and viewer.id == project.owner_id,
        viewer_agreement_signed=bool(viewer_member and viewer_member.agreement_signed),
        viewer_has_pending_application=viewer_pending,
        # 待处理申请数量只对成员有意义，但它不泄露申请内容，公开也无所谓。
        pending_application_count=pending_count,
    )


def application_out(db: Session, application: Application) -> ApplicationOut:
    applicant = db.get(User, application.applicant_id)
    project = db.get(Project, application.project_id)
    return ApplicationOut(
        id=application.id,
        project_id=application.project_id,
        project_title=project.title if project else "",
        applicant=user_public(applicant),
        role=application.role,
        why=application.why,
        time_commitment=application.time_commitment,
        proof=application.proof,
        status=application.status,
        created_at=application.created_at,
        decided_at=application.decided_at,
    )


def agreement_out(db: Session, agreement: Agreement, viewer: User | None) -> AgreementOut:
    acceptances = list(
        db.execute(
            select(AgreementAcceptance)
            .where(AgreementAcceptance.agreement_id == agreement.id)
            .order_by(AgreementAcceptance.accepted_at.asc())
        )
        .scalars()
        .all()
    )
    users = _users_by_id(db, {a.user_id for a in acceptances})
    accepted_ids = {a.user_id for a in acceptances}
    members = member_rows(db, agreement.project_id)
    member_users = _users_by_id(db, {m.user_id for m in members})
    creator = db.get(User, agreement.created_by)
    return AgreementOut(
        id=agreement.id,
        project_id=agreement.project_id,
        version=agreement.version,
        clauses=list(agreement.clauses or []),
        change_note=agreement.change_note,
        created_by=user_public(creator),
        created_at=agreement.created_at,
        superseded_at=agreement.superseded_at,
        accepted_by=[
            AcceptanceOut(user=user_public(users[a.user_id]), accepted_at=a.accepted_at)
            for a in acceptances
            if a.user_id in users
        ],
        pending=[
            user_public(member_users[m.user_id])
            for m in members
            if m.user_id not in accepted_ids and m.user_id in member_users
        ],
        viewer_accepted=viewer is not None and viewer.id in accepted_ids,
    )


def deliverables_out(db: Session, milestone_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[DeliverableOut]]:
    if not milestone_ids:
        return {}
    rows = list(
        db.execute(
            select(Deliverable)
            .where(Deliverable.milestone_id.in_(milestone_ids))
            .order_by(Deliverable.created_at.asc())
        )
        .scalars()
        .all()
    )
    users = _users_by_id(db, {d.created_by for d in rows})
    out: dict[uuid.UUID, list[DeliverableOut]] = {}
    for d in rows:
        out.setdefault(d.milestone_id, []).append(
            DeliverableOut(
                id=d.id,
                title=d.title,
                kind=d.kind,
                url=d.url,
                note=d.note,
                created_by=user_public(users[d.created_by]),
                created_at=d.created_at,
            )
        )
    return out


def milestones_out(db: Session, project_id: uuid.UUID) -> list[MilestoneOut]:
    rows = list(
        db.execute(
            select(Milestone)
            .where(Milestone.project_id == project_id)
            .order_by(Milestone.position.asc(), Milestone.created_at.asc())
        )
        .scalars()
        .all()
    )
    users = _users_by_id(
        db, {m.owner_id for m in rows} | {m.completed_by for m in rows}  # type: ignore[arg-type]
    )
    by_milestone = deliverables_out(db, [m.id for m in rows])
    return [
        MilestoneOut(
            id=m.id,
            project_id=m.project_id,
            name=m.name,
            description=m.description,
            position=m.position,
            status=m.status,
            stage=m.stage,
            owner=user_public(users[m.owner_id]) if m.owner_id in users else None,
            completed_at=m.completed_at,
            completed_by=user_public(users[m.completed_by]) if m.completed_by in users else None,
            created_at=m.created_at,
            deliverables=by_milestone.get(m.id, []),
        )
        for m in rows
    ]


def events_out(db: Session, project_id: uuid.UUID, limit: int = 100) -> list[ProjectEventOut]:
    rows = list(
        db.execute(
            select(ProjectEvent)
            .where(ProjectEvent.project_id == project_id)
            .order_by(ProjectEvent.created_at.desc())
            .limit(limit)
        )
        .scalars()
        .all()
    )
    users = _users_by_id(db, {e.actor_id for e in rows})  # type: ignore[arg-type]
    return [
        ProjectEventOut(
            id=e.id,
            kind=e.kind,
            text=e.text,
            tags=list(e.tags or []),
            actor=user_public(users[e.actor_id]) if e.actor_id in users else None,
            created_at=e.created_at,
        )
        for e in rows
    ]


def curation_out(db: Session, curation: WorkCuration | None) -> CurationOut | None:
    if curation is None:
        return None
    curator = db.get(User, curation.curator_id)
    return CurationOut(
        fit=curation.fit,
        avoid=curation.avoid,
        metrics=dict(curation.metrics or {}),
        editorial=curation.editorial,
        commercial_relation=curation.commercial_relation,
        audience_tags=list(curation.audience_tags or []),
        curator=user_public(curator),
        updated_at=curation.updated_at,
    )


def work_out(db: Session, work: Work, viewer_taste: set[str] | None = None) -> WorkOut:
    tags = list(
        db.execute(select(WorkTag).where(WorkTag.work_id == work.id)).scalars().all()
    )
    curation = db.execute(
        select(WorkCuration).where(WorkCuration.work_id == work.id)
    ).scalar_one_or_none()
    project = db.get(Project, work.project_id)
    publisher = db.get(User, work.published_by)

    taste = viewer_taste or set()
    tag_values = {t.tag for t in tags}
    audience = set(curation.audience_tags) if curation else set()
    reasons: list[str] = []
    score = 0.0
    for t in sorted(tag_values & taste):
        score += 1.0
        reasons.append(f"作品标签「{t}」命中你的口味")
    for t in sorted(audience & taste):
        score += 1.5
        reasons.append(f"ISH 编辑认为它适合喜欢「{t}」的人")
    if curation is not None:
        # 被真正体验过的作品优先——这是编辑判断，不是付费位。
        score += 0.5
        reasons.append("ISH 编辑已实际体验并标注")
    if curation is not None and curation.commercial_relation != "none":
        reasons.append(f"披露：{RELATION_LABELS[curation.commercial_relation]}")

    relation = curation.commercial_relation if curation else "none"
    return WorkOut(
        id=work.id,
        project_id=work.project_id,
        project_title=project.title if project else "",
        title=work.title,
        summary=work.summary,
        kind=work.kind,
        url=work.url,
        published_at=work.published_at,
        published_by=user_public(publisher),
        credits=members_out(db, work.project_id),
        tags=[WorkTagOut(tag=t.tag, source=t.source) for t in tags],
        curation=curation_out(db, curation),
        match_score=round(score, 2),
        match_reasons=reasons,
        disclosure=RELATION_LABELS[relation],
    )


def viewer_taste(db: Session, user: User | None) -> set[str]:
    if user is None:
        return set()
    rows = db.execute(select(UserTaste.tag).where(UserTaste.user_id == user.id)).scalars().all()
    return set(rows)


def portfolio_out(db: Session, user: User) -> PortfolioOut:
    """履历完全由项目事实推导。没有任何字段来自用户自填。"""
    memberships = list(
        db.execute(
            select(ProjectMember)
            .where(ProjectMember.user_id == user.id, ProjectMember.left_at.is_(None))
            .order_by(ProjectMember.joined_at.desc())
        )
        .scalars()
        .all()
    )
    entries: list[PortfolioProjectOut] = []
    collaborator_ids: set[uuid.UUID] = set()
    work_count = 0

    for m in memberships:
        project = db.get(Project, m.project_id)
        if project is None:
            continue
        _, milestones_total = _milestone_counts(db, project.id)
        completed_by_user = db.execute(
            select(func.count())
            .select_from(Milestone)
            .where(Milestone.project_id == project.id, Milestone.completed_by == user.id)
        ).scalar_one()
        deliverables_by_user = db.execute(
            select(func.count())
            .select_from(Deliverable)
            .where(Deliverable.project_id == project.id, Deliverable.created_by == user.id)
        ).scalar_one()
        works = list(
            db.execute(select(Work.title).where(Work.project_id == project.id)).scalars().all()
        )
        work_count += len(works)

        agreement = current_agreement_row(db, project.id)
        signed_version = None
        if agreement is not None and db.execute(
            select(AgreementAcceptance.id).where(
                AgreementAcceptance.agreement_id == agreement.id,
                AgreementAcceptance.user_id == user.id,
            )
        ).first():
            signed_version = agreement.version

        for other in member_rows(db, project.id):
            if other.user_id != user.id:
                collaborator_ids.add(other.user_id)

        entries.append(
            PortfolioProjectOut(
                project_id=project.id,
                title=project.title,
                category=project.category,
                mode=project.mode,
                stage=project.stage,
                role=m.role,
                is_owner=m.is_owner,
                joined_at=m.joined_at,
                milestones_completed_by_user=completed_by_user,
                milestones_total=milestones_total,
                deliverables_by_user=deliverables_by_user,
                agreement_version_signed=signed_version,
                works=works,
            )
        )

    collaborators = _users_by_id(db, collaborator_ids)
    return PortfolioOut(
        user=user_public(user),
        projects=entries,
        project_count=len(entries),
        work_count=work_count,
        collaborators=[user_public(u) for u in collaborators.values()],
        note="以上全部由项目事实推导，用户不能直接写入。ISH 不生成单一信用分或能力分。",
    )


def audit_out(db: Session, events: list[AuditEvent]) -> list[AuditEventOut]:
    users = _users_by_id(db, {e.actor_id for e in events})  # type: ignore[arg-type]
    return [
        AuditEventOut(
            seq=e.seq,
            actor_handle=users[e.actor_id].handle if e.actor_id in users else None,
            action=e.action,
            object_type=e.object_type,
            object_id=e.object_id,
            project_id=e.project_id,
            summary=e.summary,
            payload=dict(e.payload or {}),
            created_at=e.created_at,
            prev_hash=e.prev_hash,
            hash=e.hash,
        )
        for e in events
    ]


def disclosures_out(db: Session) -> list[DisclosureOut]:
    rows = list(
        db.execute(
            select(WorkCuration).where(WorkCuration.commercial_relation != "none")
        )
        .scalars()
        .all()
    )
    out: list[DisclosureOut] = []
    for c in rows:
        work = db.get(Work, c.work_id)
        curator = db.get(User, c.curator_id)
        if work is None or curator is None:
            continue
        out.append(
            DisclosureOut(
                work_id=work.id,
                work_title=work.title,
                commercial_relation=c.commercial_relation,
                label=RELATION_LABELS[c.commercial_relation],
                curator_handle=curator.handle,
                updated_at=c.updated_at,
            )
        )
    return out


def stalled_days(db: Session, project_id: uuid.UUID) -> int | None:
    last = db.execute(
        select(func.max(ProjectEvent.created_at)).where(ProjectEvent.project_id == project_id)
    ).scalar_one_or_none()
    if last is None:
        return None
    return (datetime.now(UTC) - last).days
