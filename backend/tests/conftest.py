"""测试跑在独立的 ish_test 库上，schema 由真实的 alembic 迁移建立。

每个测试跑在一个外层事务里，结束时整体回滚：
既不需要 DELETE 清理（audit_events 本来就不允许删），也不会互相污染。
"""

import os
import uuid
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.main import app
from app.models import User
from app.security import hash_password

BACKEND_DIR = Path(__file__).resolve().parent.parent
TEST_PASSWORD = "test-password-123"


@pytest.fixture(scope="session")
def engine():
    url = settings.test_database_url
    eng = create_engine(url, future=True)
    with eng.begin() as conn:
        conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))

    os.environ["ALEMBIC_DATABASE_URL"] = url
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", url)
    command.upgrade(cfg, "head")

    yield eng
    eng.dispose()


@pytest.fixture
def db(engine):
    connection = engine.connect()
    trans = connection.begin()
    session = Session(
        bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False
    )
    try:
        yield session
    finally:
        session.close()
        trans.rollback()
        connection.close()


class Api:
    """带 CSRF double-submit 的测试客户端。每个实例是一个独立的浏览器会话。"""

    def __init__(self, client: TestClient):
        self.client = client
        self.user: dict | None = None

    def _headers(self, extra: dict | None = None) -> dict:
        headers = dict(extra or {})
        token = self.client.cookies.get(settings.csrf_cookie)
        if token:
            headers.setdefault(settings.csrf_header, token)
        return headers

    def get(self, url: str, **kw):
        return self.client.get(url, headers=self._headers(kw.pop("headers", None)), **kw)

    def post(self, url: str, **kw):
        return self.client.post(url, headers=self._headers(kw.pop("headers", None)), **kw)

    def put(self, url: str, **kw):
        return self.client.put(url, headers=self._headers(kw.pop("headers", None)), **kw)

    def patch(self, url: str, **kw):
        return self.client.patch(url, headers=self._headers(kw.pop("headers", None)), **kw)

    def delete(self, url: str, **kw):
        return self.client.delete(url, headers=self._headers(kw.pop("headers", None)), **kw)

    def raw_post_without_csrf(self, url: str, **kw):
        return self.client.post(url, **kw)


@pytest.fixture
def make_client(db):
    app.dependency_overrides[get_db] = lambda: db
    created: list[TestClient] = []

    def factory() -> Api:
        client = TestClient(app)
        created.append(client)
        return Api(client)

    yield factory

    for client in created:
        client.close()
    app.dependency_overrides.clear()


@pytest.fixture
def anon(make_client) -> Api:
    return make_client()


@pytest.fixture
def new_user(make_client, db):
    """注册并登录一个用户，返回它自己的会话客户端。"""
    counter = {"n": 0}

    def factory(handle: str | None = None, *, curator: bool = False) -> Api:
        counter["n"] += 1
        handle = handle or f"user{counter['n']}"
        api = make_client()
        response = api.post(
            "/api/auth/register",
            json={
                "email": f"{handle}@test.demo",
                "handle": handle,
                "display_name": handle.upper(),
                "password": TEST_PASSWORD,
            },
        )
        assert response.status_code == 201, response.text
        api.user = response.json()
        if curator:
            # 编辑权限不能靠注册接口拿到——只能由平台自己授予。
            user = db.get(User, uuid.UUID(api.user["id"]))
            user.is_curator = True
            db.commit()
            api.user["is_curator"] = True
        return api

    return factory


@pytest.fixture
def curator_user(db):
    """直接建一个编辑账号（不经过注册接口）。"""

    def factory(handle: str = "editor") -> User:
        user = User(
            email=f"{handle}@test.demo",
            handle=handle,
            display_name="编辑",
            password_hash=hash_password(TEST_PASSWORD),
            bio="",
            skills=[],
            is_curator=True,
        )
        db.add(user)
        db.commit()
        return user

    return factory


# ------------------------------------------------------------------ 常用流程封装


def create_project(api: Api, title: str = "测试项目", needs: list[str] | None = None) -> dict:
    response = api.post(
        "/api/projects",
        json={
            "title": title,
            "summary": "这是一个用于测试的项目描述，长度足够通过校验。",
            "category": "独立游戏",
            "mode": "interest",
            "duration": "3 个月",
            "needs": needs if needs is not None else ["程序"],
            "owner_role": "发起人",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def accept_current_agreement(api: Api, project_id: str) -> dict:
    agreement = api.get(f"/api/projects/{project_id}/agreement").json()
    response = api.post(f"/api/agreements/{agreement['id']}/accept")
    assert response.status_code == 200, response.text
    return response.json()


def join_project(owner: Api, member: Api, project_id: str, role: str = "程序") -> dict:
    """完整走一遍 UC-02：申请 → 发起人接受。"""
    response = member.post(
        f"/api/projects/{project_id}/applications",
        json={"role": role, "why": "我想参与这个项目，因为它正好是我一直想做的东西。"},
    )
    assert response.status_code == 201, response.text
    application = response.json()
    accepted = owner.post(f"/api/applications/{application['id']}/accept")
    assert accepted.status_code == 200, accepted.text
    return accepted.json()
