"""UC-09 验证平台是否值得信任。

这一组测试的对象不是业务功能，而是 ISH 对用户的承诺本身：
「不要求你相信我们是好人，而是让你可以自己验证。」
"""

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from tests.conftest import accept_current_agreement, create_project, join_project

TRIGGER = "audit_events_no_update_delete"


def test_audit_log_is_append_only(new_user, db):
    """数据库层面禁止改写历史：UPDATE / DELETE / TRUNCATE 全部被拒。

    这不是应用层的 if 判断——就算后端代码被攻破或者运营手滑跑了一条 SQL，
    也改不动已经写下的记录。
    """
    alice = new_user("audit_owner")
    create_project(alice, "会留下审计记录的项目")

    seq = db.execute(text("SELECT max(seq) FROM audit_events")).scalar_one()
    assert seq is not None

    with pytest.raises(DBAPIError) as update_error:
        db.execute(
            text("UPDATE audit_events SET summary = 'nothing happened' WHERE seq = :s"),
            {"s": seq},
        )
    assert "append-only" in str(update_error.value)
    db.rollback()

    with pytest.raises(DBAPIError) as delete_error:
        db.execute(text("DELETE FROM audit_events WHERE seq = :s"), {"s": seq})
    assert "append-only" in str(delete_error.value)
    db.rollback()

    with pytest.raises(DBAPIError) as truncate_error:
        db.execute(text("TRUNCATE audit_events"))
    assert "append-only" in str(truncate_error.value)
    db.rollback()

    # 记录仍然在，内容一个字没变。
    still_there = db.execute(
        text("SELECT summary FROM audit_events WHERE seq = :s"), {"s": seq}
    ).scalar_one()
    assert still_there != "nothing happened"


def test_audit_chain_verifies_after_a_full_use_case_run(new_user):
    """跑完一整条闭环之后，哈希链应该仍然自洽。"""
    alice = new_user("chain_owner")
    bob = new_user("chain_member")
    project = create_project(alice, "跑完整条链的项目")
    join_project(alice, bob, project["id"])
    accept_current_agreement(alice, project["id"])
    accept_current_agreement(bob, project["id"])
    milestone = bob.post(
        f"/api/projects/{project['id']}/milestones", json={"name": "Demo"}
    ).json()
    bob.post(f"/api/milestones/{milestone['id']}/complete")
    alice.post(f"/api/projects/{project['id']}/works", json={"title": "作品"})

    result = alice.get("/api/audit/verify").json()
    assert result["ok"] is True
    assert result["checked"] >= 7
    assert result["broken_at_seq"] is None
    assert len(result["head_hash"]) == 64


def test_tampering_with_history_is_detected_even_by_a_dba(new_user, db):
    """模拟一个能直接操作数据库、甚至能关掉触发器的人。

    触发器拦不住拥有 DDL 权限的人，所以还有第二层：哈希链。
    改一个字，verify 立刻指出是第几条断的。
    """
    alice = new_user("tamper_owner")
    create_project(alice, "会被篡改的项目")

    assert alice.get("/api/audit/verify").json()["ok"] is True

    seq = db.execute(
        text("SELECT seq FROM audit_events WHERE action = 'PROJECT_CREATED' ORDER BY seq DESC")
    ).scalars().first()

    db.execute(text(f"ALTER TABLE audit_events DISABLE TRIGGER {TRIGGER}"))
    db.execute(
        text("UPDATE audit_events SET summary = '什么都没发生过' WHERE seq = :s"), {"s": seq}
    )
    db.execute(text(f"ALTER TABLE audit_events ENABLE TRIGGER {TRIGGER}"))
    db.commit()

    result = alice.get("/api/audit/verify").json()
    assert result["ok"] is False
    assert result["broken_at_seq"] == seq
    assert "改写" in result["reason"]


def test_deleting_a_record_breaks_the_chain(new_user, db):
    """删掉中间一条记录同样会被发现——链断在缺口的下一条。"""
    alice = new_user("delete_owner")
    create_project(alice, "第一个项目")
    create_project(alice, "第二个项目")

    rows = db.execute(
        text("SELECT seq FROM audit_events ORDER BY seq DESC LIMIT 2")
    ).scalars().all()
    newest, victim = rows[0], rows[1]

    db.execute(text(f"ALTER TABLE audit_events DISABLE TRIGGER {TRIGGER}"))
    db.execute(text("DELETE FROM audit_events WHERE seq = :s"), {"s": victim})
    db.execute(text(f"ALTER TABLE audit_events ENABLE TRIGGER {TRIGGER}"))
    db.commit()

    result = alice.get("/api/audit/verify").json()
    assert result["ok"] is False
    assert result["broken_at_seq"] == newest
    assert "删除或插队" in result["reason"]


def test_audit_and_business_write_share_one_transaction(new_user, db):
    """审计不会和事实脱节：业务写入失败时，审计记录也不该留下。"""
    alice = new_user("atomic_owner")
    before = db.execute(text("SELECT count(*) FROM audit_events")).scalar_one()

    # 缺少必填字段，请求在写库之前就被 pydantic 拒了。
    failed = alice.post("/api/projects", json={"title": "不完整"})
    assert failed.status_code == 422

    after = db.execute(text("SELECT count(*) FROM audit_events")).scalar_one()
    assert after == before


def test_key_actions_all_leave_traces(new_user):
    """契约变更、里程碑、商业关系修改——UC-09 点名的三类操作都必须留痕。"""
    alice = new_user("trace_owner")
    bob = new_user("trace_member")
    project = create_project(alice)
    join_project(alice, bob, project["id"])
    accept_current_agreement(alice, project["id"])
    accept_current_agreement(bob, project["id"])

    milestone = bob.post(
        f"/api/projects/{project['id']}/milestones", json={"name": "Demo"}
    ).json()
    bob.post(f"/api/milestones/{milestone['id']}/complete")
    work = alice.post(
        f"/api/projects/{project['id']}/works", json={"title": "作品"}
    ).json()
    alice.post(
        f"/api/projects/{project['id']}/agreements",
        json={
            "clauses": [{"key": "revenue", "title": "收益", "body": "上架后按贡献分配。"}],
            "change_note": "加收益条款",
        },
    )
    editor = new_user("trace_editor", curator=True)
    editor.put(
        f"/api/works/{work['id']}/curation",
        json={"commercial_relation": "publishing", "editorial": "ISH 参与发行"},
    )

    actions = {e["action"] for e in alice.get("/api/audit", params={"limit": 200}).json()}
    for required in {
        "PROJECT_CREATED",
        "APPLICATION_SUBMITTED",
        "APPLICATION_ACCEPTED",
        "AGREEMENT_ACCEPTED",
        "MILESTONE_COMPLETED",
        "WORK_PUBLISHED",
        "AGREEMENT_VERSION_CREATED",
        "WORK_CURATED",
    }:
        assert required in actions, f"{required} 没有留痕"


def test_agreement_change_records_who_and_what(new_user):
    """审计要能回答「项目规则发生过哪些修改」，而不只是「有过修改」。"""
    alice = new_user("note_owner")
    project = create_project(alice)
    alice.post(
        f"/api/projects/{project['id']}/agreements",
        json={
            "clauses": [{"key": "ip", "title": "IP", "body": "归全体成员共有。"}],
            "change_note": "明确 IP 归属",
        },
    )

    event = next(
        e
        for e in alice.get("/api/audit", params={"project_id": project["id"]}).json()
        if e["action"] == "AGREEMENT_VERSION_CREATED"
    )
    assert event["actor_handle"] == "note_owner"
    assert event["payload"]["version"] == 2
    assert event["payload"]["change_note"] == "明确 IP 归属"
    assert "重新确认" in event["summary"]


def test_every_principle_names_its_enforcement(anon):
    """原则页上的每一条都必须指向一个真实实现，否则它只是标语。"""
    principles = anon.get("/api/transparency/principles").json()
    assert len(principles) >= 4
    for principle in principles:
        assert principle["enforced_by"].strip(), f"{principle['key']} 没有对应的技术实现"
