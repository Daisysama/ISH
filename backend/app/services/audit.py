import hashlib
import json
import uuid
from datetime import UTC, datetime

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.models import AuditEvent

GENESIS_HASH = "0" * 64
# 用固定的 advisory lock key 串行化写入，保证 seq 与 prev_hash 不会交错。
_CHAIN_LOCK_KEY = 730153001


def _canonical(payload: dict) -> str:
    return json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def compute_hash(
    *,
    seq: int,
    actor_id: uuid.UUID | None,
    action: str,
    object_type: str,
    object_id: str,
    project_id: uuid.UUID | None,
    summary: str,
    payload: dict,
    created_at: datetime,
    prev_hash: str,
) -> str:
    material = "|".join(
        [
            str(seq),
            str(actor_id or ""),
            action,
            object_type,
            object_id,
            str(project_id or ""),
            summary,
            _canonical(payload),
            created_at.astimezone(UTC).isoformat(),
            prev_hash,
        ]
    )
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


def record(
    db: Session,
    *,
    action: str,
    object_type: str,
    object_id: str | uuid.UUID = "",
    actor_id: uuid.UUID | None = None,
    project_id: uuid.UUID | None = None,
    summary: str = "",
    payload: dict | None = None,
) -> AuditEvent:
    """写入一条审计事件，并把它接到哈希链末端。

    调用方不需要 commit——事件和业务写入共享同一个事务，
    要么一起成立，要么一起不成立。审计不会和事实脱节。
    """
    payload = payload or {}
    db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": _CHAIN_LOCK_KEY})

    prev_hash = db.execute(
        select(AuditEvent.hash).order_by(AuditEvent.seq.desc()).limit(1)
    ).scalar_one_or_none()
    prev_hash = prev_hash or GENESIS_HASH

    seq = db.execute(text("SELECT nextval('audit_events_seq_seq')")).scalar_one()
    created_at = datetime.now(UTC)

    event = AuditEvent(
        seq=seq,
        actor_id=actor_id,
        action=action,
        object_type=object_type,
        object_id=str(object_id),
        project_id=project_id,
        summary=summary,
        payload=payload,
        created_at=created_at,
        prev_hash=prev_hash,
        hash=compute_hash(
            seq=seq,
            actor_id=actor_id,
            action=action,
            object_type=object_type,
            object_id=str(object_id),
            project_id=project_id,
            summary=summary,
            payload=payload,
            created_at=created_at,
            prev_hash=prev_hash,
        ),
    )
    db.add(event)
    db.flush()
    return event


def verify_chain(db: Session) -> dict:
    """重算整条链。任何一行被改写、删除或插队都会在这里暴露。"""
    events = db.execute(select(AuditEvent).order_by(AuditEvent.seq.asc())).scalars().all()
    prev_hash = GENESIS_HASH
    for event in events:
        expected = compute_hash(
            seq=event.seq,
            actor_id=event.actor_id,
            action=event.action,
            object_type=event.object_type,
            object_id=event.object_id,
            project_id=event.project_id,
            summary=event.summary,
            payload=event.payload,
            created_at=event.created_at,
            prev_hash=prev_hash,
        )
        if event.prev_hash != prev_hash:
            return {
                "ok": False,
                "checked": len(events),
                "broken_at_seq": event.seq,
                "reason": "prev_hash 与上一条的 hash 对不上（有记录被删除或插队）",
            }
        if event.hash != expected:
            return {
                "ok": False,
                "checked": len(events),
                "broken_at_seq": event.seq,
                "reason": "内容与 hash 对不上（这条记录被改写过）",
            }
        prev_hash = event.hash
    return {
        "ok": True,
        "checked": len(events),
        "broken_at_seq": None,
        "reason": "",
        "head_hash": prev_hash,
    }
