from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import agreements, applications, auth, milestones, projects, transparency, users, works
from app.config import settings
from app.security import csrf_tokens_match

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

app = FastAPI(
    title="ISH API",
    version="0.2.0",
    # 放在 /api 下，前端 dev server 的代理才能直接透出去。
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    description=(
        "伊始 / ISH —— Idea → People → Trust → Execution → Work → Audience。\n\n"
        "这是 V0.2 工程版：真实认证、PostgreSQL、服务端权限校验、append-only 审计链。\n"
        "所有接口都可以直接在这里试；越权请求会诚实地返回 403。"
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def csrf_guard(request: Request, call_next):
    """会话放在 cookie 里，所以写操作必须做 double-submit 校验。

    只在带着会话 cookie 时检查：登录和注册本来就没有会话可被利用。
    """
    if request.method in UNSAFE_METHODS and request.url.path.startswith("/api"):
        if request.cookies.get(settings.session_cookie):
            cookie_token = request.cookies.get(settings.csrf_cookie)
            header_token = request.headers.get(settings.csrf_header)
            if not csrf_tokens_match(cookie_token, header_token):
                return JSONResponse(
                    status_code=403,
                    content={"detail": f"CSRF 校验失败：请在请求头带上 {settings.csrf_header}"},
                )
    return await call_next(request)


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(projects.router)
app.include_router(applications.router)
app.include_router(agreements.router)
app.include_router(milestones.router)
app.include_router(works.router)
app.include_router(transparency.router)


@app.get("/api/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok", "service": "ish-api", "version": app.version}
