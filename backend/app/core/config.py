from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ---------- App ----------
    APP_NAME: str = "Grace Path Centre Management System"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # ---------- Security ----------
    SECRET_KEY: str = "change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours

    # ---------- Database ----------
    DATABASE_URL: str = "sqlite:///./gracepath.db"

    # ---------- M-Pesa Daraja ----------
    MPESA_CONSUMER_KEY: str = ""
    MPESA_CONSUMER_SECRET: str = ""
    MPESA_SHORTCODE: str = "174379"
    MPESA_PASSKEY: str = ""
    MPESA_ENV: str = "sandbox"  # sandbox | production
    MPESA_CALLBACK_URL: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()