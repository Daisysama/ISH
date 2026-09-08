from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

# 项目自带的本地数据库集群跑在 55432 上，避开系统里可能已经存在的 5432。
LOCAL_DB = "postgresql+psycopg://ish:ish_dev_password@127.0.0.1:55432"


class Settings(BaseSettings):
    """配置来源优先级：环境变量（前缀 ISH_）> backend/.env > 下面的默认值。

    默认值直接指向 scripts/setup.ps1 建出来的本地集群，
    所以正常情况下不需要设任何东西就能跑起来。
    想连自己的 PostgreSQL，复制 .env.example 成 .env 改掉连接串即可。
    """

    model_config = SettingsConfigDict(env_prefix="ISH_", env_file=".env", extra="ignore")

    database_url: str = f"{LOCAL_DB}/ish"
    test_database_url: str = f"{LOCAL_DB}/ish_test"

    jwt_secret: str = "dev-only-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    session_ttl_hours: int = 24 * 7

    session_cookie: str = "ish_session"
    csrf_cookie: str = "ish_csrf"
    csrf_header: str = "X-CSRF-Token"
    cookie_secure: bool = False
    cookie_samesite: str = "lax"

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
