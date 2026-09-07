"""UC-03 立契：让陌生人敢于一起做事。

这一组测试守住的是 ISH 最容易变成空话的一环——
「有个契约页面」和「契约真的约束了系统行为」是两回事。
"""

from tests.conftest import accept_current_agreement, create_project, join_project

NEW_CLAUSES = [
    {"key": "scope", "title": "我们在做什么", "body": "项目范围不变。"},
    {"key": "revenue", "title": "未来收益", "body": "如果上架，收入按贡献比例分配，具体比例上架前再定。"},
]


def test_agreement_change_requires_resign(new_user):
    """契约一改版本，所有旧确认失效，成员必须重新确认才能继续推进项目。

    这是整套信任机制的支点：如果改契约不需要重新签，
    那「立契」就只是一个可以被单方面改写的页面。
    """
    alice = new_user("owner1")
    bob = new_user("member1")
    project = create_project(alice)
    join_project(alice, bob, project["id"])

    accept_current_agreement(alice, project["id"])
    accept_current_agreement(bob, project["id"])

    # 已签状态下，bob 可以正常推进项目。
    ok = bob.post(
        f"/api/projects/{project['id']}/milestones", json={"name": "签了之后能干活"}
    )
    assert ok.status_code == 201

    # alice 改了收益条款——这正是最容易日后翻脸的地方。
    updated = alice.post(
        f"/api/projects/{project['id']}/agreements",
        json={"clauses": NEW_CLAUSES, "change_note": "加入收益分配条款"},
    )
    assert updated.status_code == 201
    assert updated.json()["version"] == 2

    # bob 的旧确认不再算数。
    agreement = bob.get(f"/api/projects/{project['id']}/agreement").json()
    assert agreement["viewer_accepted"] is False
    assert [u["handle"] for u in agreement["pending"]] == ["member1"] or "member1" in [
        u["handle"] for u in agreement["pending"]
    ]

    # 而且不是「界面上提示一下」，是后端直接拒绝。
    blocked = bob.post(
        f"/api/projects/{project['id']}/milestones", json={"name": "没重新签还想干活"}
    )
    assert blocked.status_code == 403
    assert "重新确认契约" in blocked.json()["detail"]

    # 重新确认之后恢复。
    accept_current_agreement(bob, project["id"])
    assert (
        bob.post(
            f"/api/projects/{project['id']}/milestones", json={"name": "重新签完可以继续"}
        ).status_code
        == 201
    )


def test_old_agreement_versions_are_never_rewritten(new_user):
    """改契约产生新版本行，旧版本原文和当时的确认记录都留在库里。"""
    alice = new_user("owner2")
    bob = new_user("member2")
    project = create_project(alice)
    join_project(alice, bob, project["id"])
    accept_current_agreement(bob, project["id"])

    v1 = alice.get(f"/api/projects/{project['id']}/agreement").json()
    v1_clauses = v1["clauses"]

    alice.post(
        f"/api/projects/{project['id']}/agreements",
        json={"clauses": NEW_CLAUSES, "change_note": "改一版"},
    )

    history = alice.get(f"/api/projects/{project['id']}/agreements").json()
    assert [a["version"] for a in history] == [2, 1]

    old = next(a for a in history if a["version"] == 1)
    assert old["clauses"] == v1_clauses, "旧版本条款不能被改写"
    assert old["superseded_at"] is not None
    assert "member2" in [a["user"]["handle"] for a in old["accepted_by"]], (
        "bob 当时确实签过 v1，这个事实不该消失"
    )


def test_non_owner_cannot_publish_new_agreement_version(new_user):
    alice = new_user("owner3")
    bob = new_user("member3")
    stranger = new_user("stranger3")
    project = create_project(alice)
    join_project(alice, bob, project["id"])

    for actor in (bob, stranger):
        response = actor.post(
            f"/api/projects/{project['id']}/agreements",
            json={"clauses": NEW_CLAUSES, "change_note": "我想单方面改契约"},
        )
        assert response.status_code == 403


def test_non_member_cannot_accept_agreement(new_user):
    alice = new_user("owner4")
    stranger = new_user("stranger4b")
    project = create_project(alice)
    agreement = alice.get(f"/api/projects/{project['id']}/agreement").json()

    assert stranger.post(f"/api/agreements/{agreement['id']}/accept").status_code == 403


def test_accepting_a_superseded_version_is_rejected(new_user):
    """不能通过确认旧版本来绕开新条款。"""
    alice = new_user("owner5")
    bob = new_user("member5")
    project = create_project(alice)
    join_project(alice, bob, project["id"])
    v1_id = alice.get(f"/api/projects/{project['id']}/agreement").json()["id"]

    alice.post(
        f"/api/projects/{project['id']}/agreements",
        json={"clauses": NEW_CLAUSES, "change_note": "v2"},
    )

    response = bob.post(f"/api/agreements/{v1_id}/accept")
    assert response.status_code == 409


def test_health_reports_unsigned_members(new_user):
    alice = new_user("owner6")
    bob = new_user("member6")
    project = create_project(alice)
    join_project(alice, bob, project["id"])
    accept_current_agreement(alice, project["id"])

    health = alice.get(f"/api/projects/{project['id']}/health").json()
    assert "还没确认当前版本契约" in health["hint"]
