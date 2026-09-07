import uuid
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.deps import DbSession
from app.models import AuditEvent
from app.schemas import AuditEventOut, ChainVerifyOut, DisclosureOut
from app.serializers import audit_out, disclosures_out
from app.services import audit as audit_service

router = APIRouter(prefix="/api", tags=["transparency"])

PRINCIPLES = [
    {
        "key": "editorial_not_ads",
        "title": "编辑 ≠ 广告",
        "body": "商业关系必须随作品一起披露，并且不参与推荐排序的计算。",
        "enforced_by": "GET /api/works 的排序只用编辑标注与用户口味；商业关系只出现在披露字段里。",
    },
    {
        "key": "facts_not_scores",
        "title": "项目事实 ≠ 社会评分",
        "body": "ISH 记录你做过什么，不生成一个决定你人格价值的总分。",
        "enforced_by": "履历完全由项目事实推导，API 没有任何写入履历的路径，也没有信用分字段。",
    },
    {
        "key": "changes_leave_traces",
        "title": "变更必须留痕",
        "body": "契约、里程碑、商业关系的每一次修改都进入 append-only 的审计链。",
        "enforced_by": "audit_events 表由数据库触发器禁止 UPDATE / DELETE / TRUNCATE，并用哈希链自证完整。",
    },
    {
        "key": "verifiable_not_trusted",
        "title": "可验证 > 请相信我们",
        "body": "任何人都可以自己跑一次校验，而不必相信 ISH 的自我陈述。",
        "enforced_by": "GET /api/audit/verify 会重算整条哈希链并指出第一个断点。",
    },
]


@router.get("/audit", response_model=list[AuditEventOut])
def list_audit(
    db: DbSession,
    project_id: uuid.UUID | None = None,
    action: str | None = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> list[AuditEventOut]:
    """审计日志公开可读。

    payload 里只放操作事实，不放申请内容、私信这类需要权限隔离的内容——
    透明不等于把所有人的隐私摊开。
    """
    stmt = select(AuditEvent)
    if project_id:
        stmt = stmt.where(AuditEvent.project_id == project_id)
    if action:
        stmt = stmt.where(AuditEvent.action == action)
    rows = list(db.execute(stmt.order_by(AuditEvent.seq.desc()).limit(limit)).scalars().all())
    return audit_out(db, rows)


@router.get("/audit/verify", response_model=ChainVerifyOut)
def verify_audit_chain(db: DbSession) -> ChainVerifyOut:
    return ChainVerifyOut(**audit_service.verify_chain(db))


@router.get("/transparency/disclosures", response_model=list[DisclosureOut])
def disclosures(db: DbSession) -> list[DisclosureOut]:
    return disclosures_out(db)


@router.get("/transparency/principles")
def principles() -> list[dict]:
    """每条原则都必须指向一个真实的技术实现，否则它就只是标语。"""
    return PRINCIPLES
