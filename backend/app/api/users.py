from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.deps import CurrentUser, DbSession
from app.models import Notification, User, UserTaste
from app.schemas import (
    MeOut,
    NotificationOut,
    PortfolioOut,
    TasteIn,
    UpdateMeIn,
    UserPublic,
)
from app.serializers import portfolio_out, user_public
from app.services import audit

router = APIRouter(prefix="/api", tags=["users"])


def _lookup(db, handle: str) -> User:
    user = db.execute(
        select(User).where(func.lower(User.handle) == handle.lower())
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "用户不存在")
    return user


@router.patch("/me", response_model=MeOut)
def update_me(body: UpdateMeIn, user: CurrentUser, db: DbSession) -> MeOut:
    """只能改自我介绍和技能标签。

    body 里就算多塞 projects / milestones / portfolio 字段，pydantic 也会直接丢掉——
    履历没有写入口。
    """
    if body.display_name is not None:
        user.display_name = body.display_name
    if body.bio is not None:
        user.bio = body.bio
    if body.skills is not None:
        user.skills = [s.strip() for s in body.skills if s.strip()]
    audit.record(
        db,
        action="PROFILE_UPDATED",
        object_type="user",
        object_id=user.id,
        actor_id=user.id,
        summary=f"{user.handle} 更新了个人资料",
    )
    db.commit()
    return MeOut(**user_public(user).model_dump(), email=user.email)


@router.get("/users/{handle}", response_model=UserPublic)
def get_user(handle: str, db: DbSession) -> UserPublic:
    return user_public(_lookup(db, handle))


@router.get("/users/{handle}/portfolio", response_model=PortfolioOut)
def get_portfolio(handle: str, db: DbSession) -> PortfolioOut:
    return portfolio_out(db, _lookup(db, handle))


@router.get("/me/portfolio", response_model=PortfolioOut)
def my_portfolio(user: CurrentUser, db: DbSession) -> PortfolioOut:
    return portfolio_out(db, user)


@router.get("/me/taste", response_model=list[str])
def get_taste(user: CurrentUser, db: DbSession) -> list[str]:
    return list(
        db.execute(select(UserTaste.tag).where(UserTaste.user_id == user.id)).scalars().all()
    )


@router.put("/me/taste", response_model=list[str])
def set_taste(body: TasteIn, user: CurrentUser, db: DbSession) -> list[str]:
    tags = []
    for raw in body.tags:
        tag = raw.strip()
        if tag and tag not in tags:
            tags.append(tag)
    db.query(UserTaste).filter(UserTaste.user_id == user.id).delete(synchronize_session=False)
    for tag in tags:
        db.add(UserTaste(user_id=user.id, tag=tag, weight=1))
    audit.record(
        db,
        action="TASTE_UPDATED",
        object_type="user",
        object_id=user.id,
        actor_id=user.id,
        summary=f"{user.handle} 更新了口味标签",
        payload={"tags": tags},
    )
    db.commit()
    return tags


@router.get("/me/notifications", response_model=list[NotificationOut])
def notifications(user: CurrentUser, db: DbSession) -> list[NotificationOut]:
    rows = (
        db.execute(
            select(Notification)
            .where(Notification.user_id == user.id)
            .order_by(Notification.created_at.desc())
            .limit(50)
        )
        .scalars()
        .all()
    )
    return [
        NotificationOut(
            id=n.id,
            kind=n.kind,
            text=n.text,
            link=n.link,
            is_read=n.is_read,
            created_at=n.created_at,
        )
        for n in rows
    ]
