"""可重复执行的演示数据。

只在库里还没有 alice 时写入，所以反复执行也不会重复灌数据。
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import (
    Agreement,
    AgreementAcceptance,
    Application,
    Milestone,
    Project,
    ProjectEvent,
    ProjectMember,
    ProjectRole,
    User,
    UserTaste,
    Work,
    WorkCuration,
    WorkTag,
)
from app.security import hash_password
from app.services import audit
from app.services.templates import default_clauses

DEMO_PASSWORD = "ish-demo-2026"


def _user(db: Session, *, email: str, handle: str, name: str, bio: str, skills: list[str], curator: bool = False) -> User:
    user = User(
        email=email,
        handle=handle,
        display_name=name,
        password_hash=hash_password(DEMO_PASSWORD),
        bio=bio,
        skills=skills,
        is_curator=curator,
    )
    db.add(user)
    db.flush()
    return user


def seed(db: Session) -> bool:
    exists = db.execute(select(User.id).where(User.handle == "alice")).first()
    if exists:
        return False

    now = datetime.now(UTC)

    alice = _user(
        db,
        email="alice@ish.demo",
        handle="alice",
        name="林知夏",
        bio="做过两个没做完的游戏。这次想把一个做完。",
        skills=["叙事设计", "策划"],
    )
    bob = _user(
        db,
        email="bob@ish.demo",
        handle="bob",
        name="周野",
        bio="自学 Unity 三年，没有科班学历，没投过简历。",
        skills=["Unity", "gameplay 程序"],
    )
    curator = _user(
        db,
        email="curator@ish.demo",
        handle="ish_editor",
        name="ISH 编辑部",
        bio="实际玩完再写。商业关系一律公开披露。",
        skills=["内容策展"],
        curator=True,
    )

    for tag in ["强剧情", "慢热", "科幻"]:
        db.add(UserTaste(user_id=bob.id, tag=tag))

    # ---------------------------------------------------------------- 项目一：已经走完整条闭环
    p1 = Project(
        title="雨没有停的那一站",
        summary=(
            "一个发生在末班车上的短篇叙事游戏。玩家只能通过听别人说话来拼出当晚发生了什么，"
            "没有战斗，没有数值，全靠对话和沉默。"
        ),
        category="独立游戏",
        mode="interest_then_revenue",
        duration="4 个月",
        assets="已有一份两万字的剧本初稿和三张场景概念图。",
        owner_id=alice.id,
        stage="demo",
        created_at=now - timedelta(days=96),
    )
    db.add(p1)
    db.flush()
    db.add(ProjectMember(project_id=p1.id, user_id=alice.id, role="发起人 / 叙事", is_owner=True))
    db.add(ProjectRole(project_id=p1.id, name="Unity 程序", filled_by_user_id=bob.id))
    db.add(ProjectRole(project_id=p1.id, name="配乐"))
    db.add(ProjectMember(project_id=p1.id, user_id=bob.id, role="Unity 程序", is_owner=False))
    db.add(
        Application(
            project_id=p1.id,
            applicant_id=bob.id,
            role="Unity 程序",
            why="我没有拿得出手的学历，但我自己写过一个对话系统，正好是你缺的那块。",
            time_commitment="每周 8-10 小时",
            proof="个人项目：一个纯对话驱动的小 demo。",
            status="accepted",
            decided_at=now - timedelta(days=88),
            decided_by=alice.id,
        )
    )

    agreement = Agreement(
        project_id=p1.id,
        version=1,
        clauses=default_clauses(p1.title, p1.mode),
        change_note="项目创建时生成的初始契约草案",
        created_by=alice.id,
    )
    db.add(agreement)
    db.flush()
    db.add(AgreementAcceptance(agreement_id=agreement.id, user_id=alice.id))
    db.add(AgreementAcceptance(agreement_id=agreement.id, user_id=bob.id))

    m1 = Milestone(
        project_id=p1.id,
        name="定义第一个可验证成果",
        description="做出一段五分钟、能让人听懂发生了什么的对话流程。",
        position=0,
        status="done",
        stage="concept",
        owner_id=alice.id,
        completed_at=now - timedelta(days=70),
        completed_by=alice.id,
    )
    m2 = Milestone(
        project_id=p1.id,
        name="可玩 Demo",
        description="完整跑通一趟末班车。",
        position=1,
        status="done",
        stage="demo",
        owner_id=bob.id,
        completed_at=now - timedelta(days=21),
        completed_by=bob.id,
    )
    m3 = Milestone(
        project_id=p1.id,
        name="加入第二条支线",
        description="第二个乘客的视角。",
        position=2,
        status="open",
        stage="beta",
    )
    db.add_all([m1, m2, m3])

    for offset, text, kind in [
        (96, "林知夏 发起了项目", "created"),
        (88, "周野 以「Unity 程序」加入团队", "member_joined"),
        (87, "周野 确认了契约 v1", "agreement"),
        (70, "航标「定义第一个可验证成果」完成", "milestone_completed"),
        (21, "航标「可玩 Demo」完成", "milestone_completed"),
        (14, "发布公开作品页：雨没有停的那一站（Demo）", "work_published"),
    ]:
        db.add(
            ProjectEvent(
                project_id=p1.id,
                actor_id=alice.id,
                kind=kind,
                text=text,
                tags=[],
                created_at=now - timedelta(days=offset),
            )
        )

    work = Work(
        project_id=p1.id,
        title="雨没有停的那一站（Demo）",
        summary="末班车上的一段对话。你不能问，只能听。",
        kind="独立游戏",
        url="https://example.com/ish-demo-work",
        published_by=alice.id,
        published_at=now - timedelta(days=14),
    )
    db.add(work)
    db.flush()
    for tag in ["强剧情", "慢热", "大量阅读"]:
        db.add(WorkTag(work_id=work.id, tag=tag, source="self"))
    for tag in ["无战斗", "一次通关约 40 分钟"]:
        db.add(WorkTag(work_id=work.id, tag=tag, source="curator"))
    db.add(
        WorkCuration(
            work_id=work.id,
            curator_id=curator.id,
            fit="愿意为了一个人物多坐两站的人；喜欢靠对话拼真相的玩家。",
            avoid="想要战斗、数值成长或者明确任务指引的玩家会觉得它什么都没发生。",
            metrics={"剧情密度": 82, "操作负担": 12, "情绪强度": 68, "探索自由": 35},
            editorial="编辑完整通关一次，用时 41 分钟。前十分钟很闷，第二个乘客上车之后才立住。",
            commercial_relation="none",
            audience_tags=["强剧情", "慢热"],
        )
    )

    # ---------------------------------------------------------------- 项目二：刚发愿，等人
    p2 = Project(
        title="县城凌晨四点",
        summary=(
            "想拍一部关于县城凌晨四点的纪录短片。已经拍了十二个小时的素材，但一个人剪不动，"
            "也不知道怎么把它变成一个能看的东西。"
        ),
        category="短片/纪录片",
        mode="interest",
        duration="3 个月",
        assets="十二小时原始素材，一台二手 A7M3。",
        owner_id=alice.id,
        stage="concept",
        created_at=now - timedelta(days=6),
    )
    db.add(p2)
    db.flush()
    db.add(ProjectMember(project_id=p2.id, user_id=alice.id, role="发起人 / 摄影", is_owner=True))
    for need in ["剪辑", "配乐", "调色"]:
        db.add(ProjectRole(project_id=p2.id, name=need))
    a2 = Agreement(
        project_id=p2.id,
        version=1,
        clauses=default_clauses(p2.title, p2.mode),
        change_note="项目创建时生成的初始契约草案",
        created_by=alice.id,
    )
    db.add(a2)
    db.flush()
    db.add(AgreementAcceptance(agreement_id=a2.id, user_id=alice.id))
    db.add(
        Milestone(
            project_id=p2.id,
            name="定义第一个可验证成果",
            description="先剪出三分钟。剪不出来就说明素材还不够。",
            position=0,
            stage="concept",
        )
    )
    db.add(
        ProjectEvent(
            project_id=p2.id,
            actor_id=alice.id,
            kind="created",
            text="林知夏 发起了项目",
            tags=["UC-01"],
            created_at=now - timedelta(days=6),
        )
    )

    # 演示数据同样进审计链——否则第一条真实操作就没有可信的链头。
    audit.record(
        db,
        action="SEED_LOADED",
        object_type="system",
        object_id="seed",
        summary="载入演示数据：2 个项目、3 个账号、1 个已发布作品",
        payload={"projects": [p1.title, p2.title], "users": ["alice", "bob", "ish_editor"]},
    )
    db.commit()
    return True


def main() -> None:
    db = SessionLocal()
    try:
        created = seed(db)
        if created:
            count = db.execute(select(func.count()).select_from(User)).scalar_one()
            print(f"[ish] 演示数据已写入，当前用户数：{count}")
        else:
            print("[ish] 演示数据已存在，跳过")
    finally:
        db.close()


if __name__ == "__main__":
    main()
