from tests.conftest import TEST_PASSWORD


def test_register_sets_httponly_session_cookie(anon):
    response = anon.post(
        "/api/auth/register",
        json={
            "email": "new@test.demo",
            "handle": "newcomer",
            "display_name": "新来的",
            "password": TEST_PASSWORD,
        },
    )
    assert response.status_code == 201
    assert response.json()["handle"] == "newcomer"

    session_cookie = next(c for c in response.cookies.jar if c.name == "ish_session")
    assert session_cookie.has_nonstandard_attr("HttpOnly"), "会话 cookie 必须是 HttpOnly"

    csrf_cookie = next(c for c in response.cookies.jar if c.name == "ish_csrf")
    assert not csrf_cookie.has_nonstandard_attr("HttpOnly"), "CSRF cookie 需要能被前端读到"


def test_password_is_not_stored_or_returned(new_user, db):
    from sqlalchemy import select

    from app.models import User

    api = new_user("hashme")
    assert "password" not in api.user
    assert "password_hash" not in api.user

    stored = db.execute(select(User.password_hash).where(User.handle == "hashme")).scalar_one()
    assert stored != TEST_PASSWORD
    assert stored.startswith("$2b$")


def test_login_rejects_wrong_password(new_user, anon):
    new_user("loginme")
    response = anon.post(
        "/api/auth/login", json={"email": "loginme@test.demo", "password": "wrong-password"}
    )
    assert response.status_code == 401


def test_unknown_email_and_wrong_password_are_indistinguishable(new_user, anon):
    """不给攻击者枚举账号的机会：两种失败必须长得一模一样。"""
    new_user("enumerate")
    wrong_password = anon.post(
        "/api/auth/login", json={"email": "enumerate@test.demo", "password": "nope-nope-nope"}
    )
    no_such_user = anon.post(
        "/api/auth/login", json={"email": "ghost@test.demo", "password": "nope-nope-nope"}
    )
    assert wrong_password.status_code == no_such_user.status_code == 401
    assert wrong_password.json() == no_such_user.json()


def test_duplicate_handle_is_rejected(new_user, anon):
    new_user("taken")
    response = anon.post(
        "/api/auth/register",
        json={
            "email": "other@test.demo",
            "handle": "taken",
            "display_name": "冒名",
            "password": TEST_PASSWORD,
        },
    )
    assert response.status_code == 409


def test_anonymous_cannot_read_me(anon):
    assert anon.get("/api/auth/me").status_code == 401


def test_write_without_csrf_header_is_rejected(new_user):
    """会话在 cookie 里，所以带着 cookie 但没有 CSRF 头的写请求必须被拒。"""
    api = new_user("csrf")
    response = api.raw_post_without_csrf(
        "/api/projects",
        json={
            "title": "跨站请求伪造出来的项目",
            "summary": "如果这条能成功，说明任何网站都能替用户发项目。",
            "category": "其他",
            "mode": "interest",
        },
    )
    assert response.status_code == 403
    assert "CSRF" in response.json()["detail"]


def test_logout_clears_session(new_user):
    api = new_user("byebye")
    assert api.get("/api/auth/me").status_code == 200
    assert api.post("/api/auth/logout").status_code == 204
    assert api.get("/api/auth/me").status_code == 401


def test_registration_cannot_grant_curator(anon, db):
    """注册接口不接受 is_curator——编辑权限只能由平台授予。"""
    from sqlalchemy import select

    from app.models import User

    response = anon.post(
        "/api/auth/register",
        json={
            "email": "sneaky@test.demo",
            "handle": "sneaky",
            "display_name": "我想当编辑",
            "password": TEST_PASSWORD,
            "is_curator": True,
        },
    )
    assert response.status_code == 201
    assert response.json()["is_curator"] is False
    stored = db.execute(select(User.is_curator).where(User.handle == "sneaky")).scalar_one()
    assert stored is False
