import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, Uuid, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base

# ISH 与作品的商业关系。UC-09 要求它必须被公开披露，而不是藏在后台。
COMMERCIAL_RELATIONS = (
    "none",  # 无商业关系
    "publishing",  # ISH 参与发行
    "paid_promotion",  # 付费广告合作
    "equity",  # ISH 持有项目权益
)


class Work(Base):
    """作品页。由项目团队发布，携带 Born on ISH 的项目血缘（UC-06）。"""

    __tablename__ = "works"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    kind: Mapped[str] = mapped_column(String(64), nullable=False, default="其他")
    url: Mapped[str] = mapped_column(Text, nullable=False, default="")
    published_by: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    published_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class WorkTag(Base):
    """作品标签。团队自己打的叫 self，ISH 编辑打的叫 curator——来源必须可区分。"""

    __tablename__ = "work_tags"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    work_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("works.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tag: Mapped[str] = mapped_column(String(64), nullable=False)
    source: Mapped[str] = mapped_column(String(16), nullable=False, default="self")


class WorkCuration(Base):
    """UC-07 的 Meaning Metadata：不是「8.6 分」，是「它是什么、谁会喜欢、谁该慎入」。

    只有 is_curator 的用户能写。商业关系必须随策展一起披露。
    """

    __tablename__ = "work_curations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    work_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("works.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    curator_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    fit: Mapped[str] = mapped_column(Text, nullable=False, default="")
    avoid: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # {"剧情密度": 70, "操作负担": 30, ...}
    metrics: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    editorial: Mapped[str] = mapped_column(Text, nullable=False, default="")
    commercial_relation: Mapped[str] = mapped_column(String(32), nullable=False, default="none")
    audience_tags: Mapped[list[str]] = mapped_column(
        ARRAY(String(64)), nullable=False, default=list
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
