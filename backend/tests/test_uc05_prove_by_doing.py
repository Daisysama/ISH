"""UC-05 让真实项目成果成为新的能力证明。"""

from tests.conftest import accept_current_agreement, create_project, join_project


def test_portfolio_is_derived_from_project_facts(new_user):
    alice = new_user("p_owner")
    bob = new_user("p_member")
    project = create_project(alice, "会长出履历的项目")
    join_project(alice, bob, project["id"], role="Unity 程序")
    accept_current_agreement(alice, project["id"])
    accept_current_agreement(bob, project["id"])

    milestone = bob.post(
        f"/api/projects/{project['id']}/milestones", json={"name": "第一个可玩版本"}
    ).json()
    bob.post(f"/api/milestones/{milestone['id']}/complete")
    bob.post(
        f"/api/milestones/{milestone['id']}/deliverables", json={"title": "build 0.1"}
    )

    portfolio = bob.get("/api/me/portfolio").json()
    assert portfolio["project_count"] == 1
    entry = portfolio["projects"][0]
    assert entry["title"] == "会长出履历的项目"
    assert entry["role"] == "Unity 程序"
    assert entry["is_owner"] is False
    assert entry["milestones_completed_by_user"] == 1
    assert entry["deliverables_by_user"] == 1
    assert entry["agreement_version_signed"] == 1
    assert [c["handle"] for c in portfolio["collaborators"]] == ["p_owner"]


def test_member_cannot_fake_portfolio(new_user):
    """履历没有写入口。

    没有「补充我的项目经历」接口，PATCH /api/me 里塞进去的额外字段会被直接丢掉，
    也不能靠改自己的资料把没做过的事写成做过的。
    """
    bob = new_user("faker")

    # 1) 没有任何创建履历条目的路径。
    for path in ("/api/me/portfolio", "/api/portfolio", "/api/me/projects"):
        response = bob.post(
            path,
            json={
                "title": "我参与过一个百万销量的游戏",
                "role": "主程",
                "milestones_completed_by_user": 99,
            },
        )
        assert response.status_code in (404, 405), f"{path} 不应该接受写入"

    # 2) PATCH /api/me 只接受自我介绍和技能，多余字段被忽略。
    patched = bob.patch(
        "/api/me",
        json={
            "bio": "我确实在自学。",
            "skills": ["Unity"],
            "projects": [{"title": "伪造的项目", "role": "主程"}],
            "is_curator": True,
        },
    )
    assert patched.status_code == 200
    assert patched.json()["bio"] == "我确实在自学。"
    assert patched.json()["is_curator"] is False

    portfolio = bob.get("/api/me/portfolio").json()
    assert portfolio["project_count"] == 0
    assert portfolio["projects"] == []

    # 3) 自我声明的技能不会变成履历事实——两者在响应里是分开的。
    assert portfolio["user"]["skills"] == ["Unity"]
    assert "伪造的项目" not in str(portfolio["projects"])


def test_leaving_a_project_does_not_erase_completed_facts(new_user, db):
    """UC-03 的退出条款：已完成并交付的成果不会因为退出而消失。"""
    import uuid

    from app.models import Milestone

    alice = new_user("keep_owner")
    bob = new_user("keep_member")
    project = create_project(alice)
    join_project(alice, bob, project["id"])
    accept_current_agreement(alice, project["id"])
    accept_current_agreement(bob, project["id"])

    milestone = bob.post(
        f"/api/projects/{project['id']}/milestones", json={"name": "退出前完成的东西"}
    ).json()
    bob.post(f"/api/milestones/{milestone['id']}/complete")

    row = db.get(Milestone, uuid.UUID(milestone["id"]))
    assert str(row.completed_by) == bob.user["id"]

    audit = bob.get("/api/audit", params={"project_id": project["id"]}).json()
    assert any(
        e["action"] == "MILESTONE_COMPLETED" and e["actor_handle"] == "keep_member" for e in audit
    )


def test_portfolio_carries_no_single_score(new_user):
    """ISH 记录你做过什么，不生成一个决定人格价值的总分。"""
    bob = new_user("no_score")
    portfolio = bob.get("/api/me/portfolio").json()
    forbidden = {"score", "credit_score", "rating", "level", "ability_score", "trust_score"}
    assert forbidden & set(portfolio.keys()) == set()
    assert "不生成单一信用分" in portfolio["note"]
