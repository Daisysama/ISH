from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """所有配置走环境变量，前缀 ISH_。docker-compose.yml 是唯一的默认值来源。"""

    model_config = SettingsConfigDict(env_prefix="ISH_", extra="ignore")

    database_url: str = "postgresql+psycopg://ish:ish_dev_password@localhost:5433/ish"
    test_database_url: str = "postgresql+psycopg://ish:ish_dev_password@localhost:5433/ish_test"

    jwt_secret: str = "dev-only-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    session_ttl_hours: int = 24 * 7

    session_cookie: str = "ish_session"
    csrf_cookie: str = "ish_csrf"
    csrf_header: str = "X-CSRF-Token"
    cookie_secure: bool = False
    cookie_samesite: str = "lax"

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    seed_on_start: bool = False

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
