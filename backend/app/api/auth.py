from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import func, select

from app.deps import CurrentUser, DbSession
from app.models import User
from app.schemas import LoginIn, MeOut, RegisterIn
from app.security import (
    PasswordTooLong,
    clear_session_cookies,
    hash_password,
    issue_session_cookies,
    verify_password,
)
from app.serializers import user_public
from app.services import audit

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _me(user: User) -> MeOut:
    return MeOut(**user_public(user).model_dump(), email=user.email)


@router.post("/register", response_model=MeOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, response: Response, db: DbSession) -> MeOut:
    email = body.email.lower()
    exists = db.execute(
        select(User.id).where(
            (func.lower(User.email) == email) | (func.lower(User.handle) == body.handle.lower())
        )
    ).first()
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "邮箱或用户名已被占用")

    try:
        password_hash = hash_password(body.password)
    except PasswordTooLong as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc

    user = User(
        email=email,
        handle=body.handle,
        display_name=body.display_name,
        password_hash=password_hash,
        bio="",
        skills=[],
        is_curator=False,
    )
    db.add(user)
    db.flush()
    audit.record(
        db,
        action="USER_REGISTERED",
        object_type="user",
        object_id=user.id,
        actor_id=user.id,
        summary=f"{user.handle} 注册",
    )
    db.commit()
    issue_session_cookies(response, user.id)
    return _me(user)


@router.post("/login", response_model=MeOut)
def login(body: LoginIn, response: Response, db: DbSession) -> MeOut:
    user = db.execute(
        select(User).where(func.lower(User.email) == body.email.lower())
    ).scalar_one_or_none()
    # 用户不存在和密码错误返回同一个错误，不给枚举账号的机会。
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "邮箱或密码不正确")
    issue_session_cookies(response, user.id)
    return _me(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    clear_session_cookies(response)


@router.get("/me", response_model=MeOut)
def me(user: CurrentUser) -> MeOut:
    return _me(user)
