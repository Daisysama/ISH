import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models import COMMERCIAL_RELATIONS, PROJECT_MODES, PROJECT_STAGES

# --------------------------------------------------------------------------------------
# 用户 / 认证
# --------------------------------------------------------------------------------------


class UserPublic(BaseModel):
    id: uuid.UUID
    handle: str
    display_name: str
    bio: str
    skills: list[str]
    is_curator: bool
    created_at: datetime


class MeOut(UserPublic):
    email: str


class RegisterIn(BaseModel):
    email: EmailStr
    handle: str = Field(min_length=2, max_length=32, pattern=r"^[a-zA-Z0-9_-]+$")
    display_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=72)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UpdateMeIn(BaseModel):
    """能改的只有自我介绍和技能标签。

    履历里的项目事实没有任何写入口——那不是 UI 藏起来了，是 API 根本没有这条路径。
    """

    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    bio: str | None = Field(default=None, max_length=2000)
    skills: list[str] | None = Field(default=None, max_length=20)


class TasteIn(BaseModel):
    tags: list[str] = Field(default_factory=list, max_length=40)


# --------------------------------------------------------------------------------------
# 项目
# --------------------------------------------------------------------------------------


class MemberOut(BaseModel):
    user: UserPublic
    role: str
    is_owner: bool
    joined_at: datetime
    agreement_signed: bool


class ProjectCreateIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    summary: str = Field(min_length=10, max_length=4000)
    category: str = Field(min_length=1, max_length=64)
    mode: Literal[PROJECT_MODES]  # type: ignore[valid-type]
    duration: str = Field(default="待议", max_length=64)
    assets: str = Field(default="", max_length=2000)
    needs: list[str] = Field(default_factory=list, max_length=12)
    owner_role: str = Field(default="发起人", max_length=64)

    @field_validator("needs")
    @classmethod
    def clean_needs(cls, v: list[str]) -> list[str]:
        return [x.strip() for x in v if x.strip()]


class ProjectUpdateIn(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    summary: str | None = Field(default=None, min_length=10, max_length=4000)
    category: str | None = None
    duration: str | None = None
    assets: str | None = None
    stage: Literal[PROJECT_STAGES] | None = None  # type: ignore[valid-type]
    needs: list[str] | None = None
    is_public: bool | None = None


class ProjectSummaryOut(BaseModel):
    id: uuid.UUID
    title: str
    summary: str
    category: str
    mode: str
    duration: str
    stage: str
    is_public: bool
    created_at: datetime
    owner: UserPublic
    needs: list[str]
    member_count: int
    milestones_done: int
    milestones_total: int
    agreement_version: int | None
    has_work: bool


class ProjectDetailOut(ProjectSummaryOut):
    assets: str
    members: list[MemberOut]
    viewer_is_member: bool
    viewer_is_owner: bool
    viewer_agreement_signed: bool
    viewer_has_pending_application: bool
    pending_application_count: int


# --------------------------------------------------------------------------------------
# 申请
# --------------------------------------------------------------------------------------


class ApplicationCreateIn(BaseModel):
    role: str = Field(min_length=1, max_length=64)
    why: str = Field(min_length=5, max_length=2000)
    time_commitment: str = Field(default="", max_length=120)
    proof: str = Field(default="", max_length=2000)


class ApplicationOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    project_title: str
    applicant: UserPublic
    role: str
    why: str
    time_commitment: str
    proof: str
    status: str
    created_at: datetime
    decided_at: datetime | None


# --------------------------------------------------------------------------------------
# 契约
# --------------------------------------------------------------------------------------


class ClauseIn(BaseModel):
    key: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=4000)


class AgreementCreateIn(BaseModel):
    clauses: list[ClauseIn] = Field(min_length=1, max_length=30)
    change_note: str = Field(default="", max_length=1000)


class AcceptanceOut(BaseModel):
    user: UserPublic
    accepted_at: datetime


class AgreementOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    version: int
    clauses: list[dict]
    change_note: str
    created_by: UserPublic
    created_at: datetime
    superseded_at: datetime | None
    accepted_by: list[AcceptanceOut]
    pending: list[UserPublic]
    viewer_accepted: bool


# --------------------------------------------------------------------------------------
# 航标 / 交付物 / 轨迹
# --------------------------------------------------------------------------------------


class DeliverableIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    kind: str = Field(default="link", max_length=32)
    url: str = Field(default="", max_length=2000)
    note: str = Field(default="", max_length=2000)


class DeliverableOut(BaseModel):
    id: uuid.UUID
    title: str
    kind: str
    url: str
    note: str
    created_by: UserPublic
    created_at: datetime


class MilestoneCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    stage: Literal[PROJECT_STAGES] | None = None  # type: ignore[valid-type]
    owner_handle: str | None = None


class MilestoneOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    description: str
    position: int
    status: str
    stage: str | None
    owner: UserPublic | None
    completed_at: datetime | None
    completed_by: UserPublic | None
    created_at: datetime
    deliverables: list[DeliverableOut]


class ProjectEventOut(BaseModel):
    id: uuid.UUID
    kind: str
    text: str
    tags: list[str]
    actor: UserPublic | None
    created_at: datetime


class HealthOut(BaseModel):
    """UC-04 的停滞提示。不催日报，只在项目真的不动时说一句。"""

    days_since_last_event: int | None
    stalled: bool
    hint: str


# --------------------------------------------------------------------------------------
# 作品
# --------------------------------------------------------------------------------------


class WorkCreateIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    summary: str = Field(default="", max_length=4000)
    kind: str = Field(default="其他", max_length=64)
    url: str = Field(default="", max_length=2000)
    tags: list[str] = Field(default_factory=list, max_length=20)


class CurationIn(BaseModel):
    fit: str = Field(default="", max_length=2000)
    avoid: str = Field(default="", max_length=2000)
    metrics: dict[str, int] = Field(default_factory=dict)
    editorial: str = Field(default="", max_length=4000)
    commercial_relation: Literal[COMMERCIAL_RELATIONS] = "none"  # type: ignore[valid-type]
    audience_tags: list[str] = Field(default_factory=list, max_length=20)
    tags: list[str] = Field(default_factory=list, max_length=20)


class CurationOut(BaseModel):
    fit: str
    avoid: str
    metrics: dict[str, int]
    editorial: str
    commercial_relation: str
    audience_tags: list[str]
    curator: UserPublic
    updated_at: datetime


class WorkTagOut(BaseModel):
    tag: str
    source: str


class WorkOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    project_title: str
    title: str
    summary: str
    kind: str
    url: str
    published_at: datetime
    published_by: UserPublic
    credits: list[MemberOut]
    tags: list[WorkTagOut]
    curation: CurationOut | None
    match_score: float
    match_reasons: list[str]
    disclosure: str


# --------------------------------------------------------------------------------------
# 履历
# --------------------------------------------------------------------------------------


class PortfolioProjectOut(BaseModel):
    project_id: uuid.UUID
    title: str
    category: str
    mode: str
    stage: str
    role: str
    is_owner: bool
    joined_at: datetime
    milestones_completed_by_user: int
    milestones_total: int
    deliverables_by_user: int
    agreement_version_signed: int | None
    works: list[str]


class PortfolioOut(BaseModel):
    user: UserPublic
    projects: list[PortfolioProjectOut]
    project_count: int
    work_count: int
    collaborators: list[UserPublic]
    note: str


# --------------------------------------------------------------------------------------
# 审计 / 透明度
# --------------------------------------------------------------------------------------


class AuditEventOut(BaseModel):
    seq: int
    actor_handle: str | None
    action: str
    object_type: str
    object_id: str
    project_id: uuid.UUID | None
    summary: str
    payload: dict
    created_at: datetime
    prev_hash: str
    hash: str


class ChainVerifyOut(BaseModel):
    ok: bool
    checked: int
    broken_at_seq: int | None
    reason: str
    head_hash: str | None = None


class DisclosureOut(BaseModel):
    work_id: uuid.UUID
    work_title: str
    commercial_relation: str
    label: str
    curator_handle: str
    updated_at: datetime


class NotificationOut(BaseModel):
    id: uuid.UUID
    kind: str
    text: str
    link: str
    is_read: bool
    created_at: datetime
