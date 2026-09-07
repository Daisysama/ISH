"""UC-06 发布成果 / UC-07 理解作品 / UC-08 找到受众。"""

import pytest

from tests.conftest import accept_current_agreement, create_project, join_project


@pytest.fixture
def published_work(new_user):
    alice = new_user("w_owner")
    bob = new_user("w_member")
    project = create_project(alice, "会发布作品的项目")
    join_project(alice, bob, project["id"])
    accept_current_agreement(alice, project["id"])
    accept_current_agreement(bob, project["id"])

    milestone = alice.post(
        f"/api/projects/{project['id']}/milestones", json={"name": "Demo 完成"}
    ).json()
    alice.post(f"/api/milestones/{milestone['id']}/complete")

    work = alice.post(
        f"/api/projects/{project['id']}/works",
        json={
            "title": "雨没有停的那一站（Demo）",
            "summary": "末班车上的一段对话。",
            "tags": ["强剧情", "慢热"],
        },
    )
    assert work.status_code == 201, work.text
    return alice, bob, project, work.json()


def test_publishing_requires_a_completed_milestone(new_user):
    """作品页是执行的结果，不是另一个宣传入口。"""
    alice = new_user("w2_owner")
    project = create_project(alice)
    accept_current_agreement(alice, project["id"])

    response = alice.post(
        f"/api/projects/{project['id']}/works", json={"title": "还没做就想发"}
    )
    assert response.status_code == 409


def test_non_member_cannot_publish_work(new_user, published_work):
    _, _, project, _ = published_work
    stranger = new_user("w_stranger")
    response = stranger.post(
        f"/api/projects/{project['id']}/works", json={"title": "蹭别人项目发作品"}
    )
    assert response.status_code == 403


def test_work_carries_born_on_ish_credits(published_work):
    alice, _, project, work = published_work
    detail = alice.get(f"/api/works/{work['id']}").json()

    assert detail["project_id"] == project["id"]
    assert detail["project_title"] == "会发布作品的项目"
    handles = {c["user"]["handle"] for c in detail["credits"]}
    assert handles == {"w_owner", "w_member"}, "全体在册成员必须出现在署名里"


def test_only_curator_can_write_meaning_metadata(new_user, published_work):
    """UC-07：团队不能自己给自己标「适合谁」，否则这层元数据就退化成宣传语。"""
    alice, bob, _, work = published_work
    payload = {
        "fit": "喜欢慢热叙事的人",
        "avoid": "想要快节奏战斗的人",
        "metrics": {"剧情密度": 82},
        "editorial": "编辑通关一次，用时 41 分钟。",
        "commercial_relation": "none",
        "audience_tags": ["强剧情"],
        "tags": ["无战斗"],
    }
    assert alice.put(f"/api/works/{work['id']}/curation", json=payload).status_code == 403
    assert bob.put(f"/api/works/{work['id']}/curation", json=payload).status_code == 403

    editor = new_user("editor1", curator=True)
    response = editor.put(f"/api/works/{work['id']}/curation", json=payload)
    assert response.status_code == 200
    curation = response.json()["curation"]
    assert curation["fit"] == "喜欢慢热叙事的人"
    assert curation["curator"]["handle"] == "editor1"


def test_curation_metrics_are_range_checked(new_user, published_work):
    _, _, _, work = published_work
    editor = new_user("editor2", curator=True)
    response = editor.put(
        f"/api/works/{work['id']}/curation",
        json={"metrics": {"剧情密度": 9001}, "commercial_relation": "none"},
    )
    assert response.status_code == 422


def test_taste_changes_recommendation_order(new_user, published_work):
    """UC-08：改口味标签，推荐顺序立刻变化，而且系统要说得出为什么。"""
    alice, _, project, _ = published_work

    # 再发一个风格完全不同的作品。
    milestone = alice.post(
        f"/api/projects/{project['id']}/milestones", json={"name": "第二个 Demo"}
    ).json()
    alice.post(f"/api/milestones/{milestone['id']}/complete")
    alice.post(
        f"/api/projects/{project['id']}/works",
        json={"title": "高速下坠", "tags": ["高操作", "轻松"]},
    )

    reader = new_user("reader1")
    reader.put("/api/me/taste", json={"tags": ["强剧情", "慢热"]})
    first = reader.get("/api/works").json()
    assert first[0]["title"] == "雨没有停的那一站（Demo）"
    assert any("强剧情" in r for r in first[0]["match_reasons"])

    reader.put("/api/me/taste", json={"tags": ["高操作"]})
    second = reader.get("/api/works").json()
    assert second[0]["title"] == "高速下坠"


def test_commercial_relation_is_disclosed_but_does_not_buy_ranking(new_user, published_work):
    """UC-09 的防火墙：钱能买到披露标签，买不到排序。"""
    alice, _, project, work = published_work
    milestone = alice.post(
        f"/api/projects/{project['id']}/milestones", json={"name": "第三个 Demo"}
    ).json()
    alice.post(f"/api/milestones/{milestone['id']}/complete")
    other = alice.post(
        f"/api/projects/{project['id']}/works",
        json={"title": "买了广告位的作品", "tags": ["高操作"]},
    ).json()

    editor = new_user("editor3", curator=True)
    editor.put(
        f"/api/works/{other['id']}/curation",
        json={
            "fit": "",
            "avoid": "",
            "metrics": {},
            "editorial": "",
            "commercial_relation": "paid_promotion",
            "audience_tags": [],
            "tags": [],
        },
    )

    reader = new_user("reader2")
    reader.put("/api/me/taste", json={"tags": ["强剧情", "慢热"]})
    works = reader.get("/api/works").json()

    assert works[0]["title"] == "雨没有停的那一站（Demo）", "付费合作不应该把作品顶上去"
    paid = next(w for w in works if w["id"] == other["id"])
    assert paid["disclosure"] == "付费广告合作"
    assert any("付费广告合作" in r for r in paid["match_reasons"])

    disclosures = reader.get("/api/transparency/disclosures").json()
    assert other["id"] in [d["work_id"] for d in disclosures]


def test_recommendation_explains_itself(new_user, published_work):
    """看到一个推荐，必须能知道它为什么出现。"""
    reader = new_user("reader3")
    reader.put("/api/me/taste", json={"tags": ["强剧情"]})
    top = reader.get("/api/works").json()[0]
    assert top["match_reasons"], "推荐必须给出理由"
    assert top["match_score"] > 0
