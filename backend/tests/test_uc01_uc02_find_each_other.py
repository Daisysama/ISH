"""UC-01 发起愿望 / UC-02 发现并加入项目。"""

from tests.conftest import create_project, join_project


def test_create_wish_produces_a_discoverable_project(new_user, anon):
    alice = new_user("alice1")
    project = create_project(alice, "雨没有停的那一站", needs=["Unity 程序", "配乐"])

    assert project["needs"] == ["Unity 程序", "配乐"]
    assert project["member_count"] == 1
    assert project["viewer_is_owner"] is True

    # 未登录的人也能发现它——UC-01 的产出是「可被响应的项目节点」。
    discovered = anon.get("/api/projects").json()
    assert project["id"] in [p["id"] for p in discovered]


def test_creating_a_wish_also_creates_a_draft_agreement(new_user):
    """不让团队在「先干起来再说」的惯性下跳过立契。"""
    alice = new_user("alice2")
    project = create_project(alice)
    agreement = alice.get(f"/api/projects/{project['id']}/agreement").json()
    assert agreement["version"] == 1
    clause_keys = {c["key"] for c in agreement["clauses"]}
    assert {"prior_ip", "new_ip", "revenue", "exit", "credit"} <= clause_keys


def test_anonymous_cannot_create_project(anon):
    response = anon.post(
        "/api/projects",
        json={
            "title": "匿名项目",
            "summary": "这条请求不应该成功，因为没有登录。",
            "category": "其他",
            "mode": "interest",
        },
    )
    assert response.status_code == 401


def test_apply_and_accept_creates_membership(new_user):
    alice = new_user("alice3")
    bob = new_user("bob3")
    project = create_project(alice, needs=["程序"])

    join_project(alice, bob, project["id"], role="程序")

    detail = bob.get(f"/api/projects/{project['id']}").json()
    assert detail["viewer_is_member"] is True
    assert detail["member_count"] == 2
    # 申请的角色正好是缺的角色，这个坑应该被填上。
    assert detail["needs"] == []


def test_non_owner_cannot_accept_application(new_user):
    """越权：路人接受别人项目的申请。

    这是最容易在原型里被忽略的一条——前端不显示按钮不等于后端拒绝请求。
    """
    alice = new_user("alice4")
    bob = new_user("bob4")
    stranger = new_user("stranger4")
    project = create_project(alice)

    submitted = bob.post(
        f"/api/projects/{project['id']}/applications",
        json={"role": "程序", "why": "我想加入这个项目，我会写代码。"},
    )
    assert submitted.status_code == 201
    application_id = submitted.json()["id"]

    response = stranger.post(f"/api/applications/{application_id}/accept")
    assert response.status_code == 403

    # 申请仍然是 pending，也没有人被塞进团队。
    assert bob.get("/api/me/applications").json()[0]["status"] == "pending"
    assert alice.get(f"/api/projects/{project['id']}").json()["member_count"] == 1


def test_ordinary_member_cannot_accept_application(new_user):
    """成员也不行——接受新人是发起人的决定。"""
    alice = new_user("alice5")
    bob = new_user("bob5")
    carol = new_user("carol5")
    project = create_project(alice)
    join_project(alice, bob, project["id"])

    submitted = carol.post(
        f"/api/projects/{project['id']}/applications",
        json={"role": "美术", "why": "我可以画场景概念图，之前画过一些。"},
    )
    response = bob.post(f"/api/applications/{submitted.json()['id']}/accept")
    assert response.status_code == 403


def test_application_content_is_visible_only_to_members(new_user):
    """申请里写的是给团队看的话，不是公开信息。"""
    alice = new_user("alice6")
    bob = new_user("bob6")
    stranger = new_user("stranger6")
    project = create_project(alice)
    bob.post(
        f"/api/projects/{project['id']}/applications",
        json={"role": "程序", "why": "这里写了我个人的经历和处境。"},
    )

    assert alice.get(f"/api/projects/{project['id']}/applications").status_code == 200
    assert stranger.get(f"/api/projects/{project['id']}/applications").status_code == 403


def test_cannot_apply_twice_or_to_own_project(new_user):
    alice = new_user("alice7")
    bob = new_user("bob7")
    project = create_project(alice)
    body = {"role": "程序", "why": "重复申请应该被挡住，不该刷屏。"}

    assert bob.post(f"/api/projects/{project['id']}/applications", json=body).status_code == 201
    assert bob.post(f"/api/projects/{project['id']}/applications", json=body).status_code == 409
    assert alice.post(f"/api/projects/{project['id']}/applications", json=body).status_code == 409


def test_rejected_application_does_not_create_membership(new_user):
    alice = new_user("alice8")
    bob = new_user("bob8")
    project = create_project(alice)
    submitted = bob.post(
        f"/api/projects/{project['id']}/applications",
        json={"role": "程序", "why": "这次会被拒绝，但不应该留下成员记录。"},
    )
    rejected = alice.post(f"/api/applications/{submitted.json()['id']}/reject")

    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"
    assert bob.get(f"/api/projects/{project['id']}").json()["viewer_is_member"] is False


def test_search_finds_projects_by_missing_role(new_user, anon):
    alice = new_user("alice9")
    create_project(alice, "需要配乐的项目", needs=["配乐"])
    create_project(alice, "需要美术的项目", needs=["像素美术"])

    found = anon.get("/api/projects", params={"need": "配乐"}).json()
    assert [p["title"] for p in found] == ["需要配乐的项目"]
