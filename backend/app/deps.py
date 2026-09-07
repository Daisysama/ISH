import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import (
    Agreement,
    AgreementAcceptance,
    Project,
    ProjectMember,
    User,
)
from app.security import read_session_token

DbSession = Annotated[Session, Depends(get_db)]


def get_optional_user(request: Request, db: DbSession) -> User | None:
    token = request.cookies.get(settings.session_cookie)
    if not token:
        return None
    user_id = read_session_token(token)
    if user_id is None:
        return None
    return db.get(User, user_id)


def get_current_user(user: Annotated[User | None, Depends(get_optional_user)]) -> User:
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "需要登录")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_optional_user)]


def get_project(project_id: uuid.UUID, db: DbSession) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "项目不存在")
    return project


def get_membership(db: Session, project_id: uuid.UUID, user_id: uuid.UUID) -> ProjectMember | None:
    return db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
            ProjectMember.left_at.is_(None),
        )
    ).scalar_one_or_none()


def require_owner(db: Session, project: Project, user: User) -> None:
    if project.owner_id != user.id:
        # 故意不区分「不存在」和「没权限」之外的细节，但状态码必须诚实：403。
        raise HTTPException(status.HTTP_403_FORBIDDEN, "只有项目发起人可以执行这个操作")


def require_member(db: Session, project: Project, user: User) -> ProjectMember:
    membership = get_membership(db, project.id, user.id)
    if membership is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "只有项目成员可以执行这个操作")
    return membership


def current_agreement(db: Session, project_id: uuid.UUID) -> Agreement | None:
    return db.execute(
        select(Agreement)
        .where(Agreement.project_id == project_id)
        .order_by(Agreement.version.desc())
        .limit(1)
    ).scalar_one_or_none()


def has_accepted_current_agreement(db: Session, project_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    agreement = current_agreement(db, project_id)
    if agreement is None:
        return True  # 还没立契的项目不拦人
    return (
        db.execute(
            select(AgreementAcceptance.id).where(
                AgreementAcceptance.agreement_id == agreement.id,
                AgreementAcceptance.user_id == user_id,
            )
        ).scalar_one_or_none()
        is not None
    )


def require_signed_member(db: Session, project: Project, user: User) -> ProjectMember:
    """UC-03 的硬规则：没有确认当前版本契约的人，不处于正式合作状态。

    契约一改版本，所有人都掉回未签状态，必须重新确认才能继续推进项目。
    这不是提示，是 403。
    """
    membership = require_member(db, project, user)
    if not has_accepted_current_agreement(db, project.id, user.id):
        agreement = current_agreement(db, project.id)
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"项目契约已更新至 v{agreement.version if agreement else '?'}，请先重新确认契约",
        )
    return membership


def require_curator(user: User) -> None:
    if not user.is_curator:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "只有 ISH 编辑可以标注作品")
