"""UC-04 推进项目直到形成成果。"""

from tests.conftest import accept_current_agreement, create_project, join_project


def _ready_project(new_user, prefix: str):
    owner = new_user(f"{prefix}_owner")
    member = new_user(f"{prefix}_member")
    project = create_project(owner)
    join_project(owner, member, project["id"])
    accept_current_agreement(owner, project["id"])
    accept_current_agreement(member, project["id"])
    return owner, member, project


def test_milestone_completion_creates_event(new_user):
    """完成航标必须留下时间线事件 + 审计记录，并且记名。

    「谁做成了什么」是履历的唯一来源，所以它不能是一个静默的状态位翻转。
    """
    owner, member, project = _ready_project(new_user, "m1")

    milestone = member.post(
        f"/api/projects/{project['id']}/milestones",
        json={"name": "可玩 Demo", "description": "完整跑通一遍", "stage": "demo"},
    ).json()

    completed = member.post(f"/api/milestones/{milestone['id']}/complete")
    assert completed.status_code == 200
    body = completed.json()
    assert body["status"] == "done"
    assert body["completed_by"]["handle"] == "m1_member"
    assert body["completed_at"] is not None

    events = member.get(f"/api/projects/{project['id']}/events").json()
    completion_events = [e for e in events if e["kind"] == "milestone_completed"]
    assert len(completion_events) == 1
    assert "可玩 Demo" in completion_events[0]["text"]
    assert completion_events[0]["actor"]["handle"] == "m1_member"

    audit = member.get("/api/audit", params={"project_id": project["id"]}).json()
    actions = [e["action"] for e in audit]
    assert "MILESTONE_COMPLETED" in actions

    # 完成带 stage 的航标会推进项目阶段——这是项目「真的在前进」的信号。
    assert member.get(f"/api/projects/{project['id']}").json()["stage"] == "demo"


def test_non_member_cannot_touch_milestones(new_user):
    owner, member, project = _ready_project(new_user, "m2")
    stranger = new_user("m2_stranger")

    milestone = member.post(
        f"/api/projects/{project['id']}/milestones", json={"name": "外人碰不到的航标"}
    ).json()

    assert (
        stranger.post(
            f"/api/projects/{project['id']}/milestones", json={"name": "路人新增"}
        ).status_code
        == 403
    )
    assert stranger.post(f"/api/milestones/{milestone['id']}/complete").status_code == 403
    assert (
        stranger.post(
            f"/api/milestones/{milestone['id']}/deliverables", json={"title": "路人交付"}
        ).status_code
        == 403
    )


def test_completing_twice_is_rejected(new_user):
    owner, member, project = _ready_project(new_user, "m3")
    milestone = member.post(
        f"/api/projects/{project['id']}/milestones", json={"name": "只能完成一次"}
    ).json()

    assert member.post(f"/api/milestones/{milestone['id']}/complete").status_code == 200
    assert member.post(f"/api/milestones/{milestone['id']}/complete").status_code == 409


def test_reopening_keeps_the_history(new_user):
    """重开航标不抹掉「它曾经被完成过」——审计里两条都在。"""
    owner, member, project = _ready_project(new_user, "m4")
    milestone = member.post(
        f"/api/projects/{project['id']}/milestones", json={"name": "会被重开的航标"}
    ).json()
    member.post(f"/api/milestones/{milestone['id']}/complete")
    member.post(f"/api/milestones/{milestone['id']}/reopen")

    audit = member.get("/api/audit", params={"project_id": project["id"]}).json()
    actions = [e["action"] for e in audit]
    assert "MILESTONE_COMPLETED" in actions
    assert "MILESTONE_REOPENED" in actions


def test_deliverable_is_attributed_to_its_author(new_user):
    owner, member, project = _ready_project(new_user, "m5")
    milestone = member.post(
        f"/api/projects/{project['id']}/milestones", json={"name": "带交付物的航标"}
    ).json()

    response = member.post(
        f"/api/milestones/{milestone['id']}/deliverables",
        json={"title": "对话系统 build 0.3", "kind": "build", "url": "https://example.com/b"},
    )
    assert response.status_code == 201
    assert response.json()["created_by"]["handle"] == "m5_member"

    listed = member.get(f"/api/projects/{project['id']}/milestones").json()
    target = next(m for m in listed if m["id"] == milestone["id"])
    assert [d["title"] for d in target["deliverables"]] == ["对话系统 build 0.3"]


def test_milestone_owner_must_be_a_project_member(new_user):
    owner, member, project = _ready_project(new_user, "m6")
    outsider = new_user("m6_outsider")

    response = member.post(
        f"/api/projects/{project['id']}/milestones",
        json={"name": "指派给外人", "owner_handle": outsider.user["handle"]},
    )
    assert response.status_code == 422
