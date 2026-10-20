from pydantic_settings import BaseSettings
from functools import lru_cache
from urllib.parse import urlsplit


class Settings(BaseSettings):
    # ---------- App ----------
    APP_NAME: str = "Grace Path Centre Management System"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # ---------- Security ----------
    SECRET_KEY: str = "change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours
    ALLOWED_ORIGINS: str = "*"
    INITIAL_ADMIN_USERNAME: str = "admin"
    INITIAL_ADMIN_EMAIL: str = "admin@gracepath.local"
    INITIAL_ADMIN_PASSWORD: str = ""

    # ---------- Database ----------
    DATABASE_URL: str = "sqlite:///./gracepath.db"

    # ---------- M-Pesa Daraja ----------
    MPESA_CONSUMER_KEY: str = ""
    MPESA_CONSUMER_SECRET: str = ""
    MPESA_SHORTCODE: str = "174379"
    MPESA_PASSKEY: str = ""
    MPESA_ENV: str = "sandbox"  # sandbox | production
    MPESA_CALLBACK_URL: str = ""

    # ---------- Equity Jenga IPN ----------
    EQUITY_ENV: str = "sandbox"
    EQUITY_MERCHANT_CODE: str = ""
    EQUITY_CONSUMER_SECRET: str = ""
    EQUITY_API_KEY: str = ""
    EQUITY_IPN_USER: str = ""
    EQUITY_IPN_PASS: str = ""
    EQUITY_PAYBILL: str = "247247"
    EQUITY_ACCOUNT_NUMBER: str = ""
    EQUITY_MERCHANT_NAME: str = "Grace Path Centre"
    EQUITY_PUSH_CALLBACK_URL: str = ""
    EQUITY_PUSH_CALLBACK_TOKEN: str = ""
    EQUITY_PRIVATE_KEY_PATH: str = "~/.JengaApi/keys/privatekey.pem"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()


def validate_deployment_settings() -> None:
    if settings.DEBUG:
        return
    if settings.SECRET_KEY == "change-me" or len(settings.SECRET_KEY) < 32:
        raise RuntimeError("Set SECRET_KEY to a random value of at least 32 characters")
    origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",")]
    if not origins or "*" in origins:
        raise RuntimeError("Set ALLOWED_ORIGINS to the deployed application origin(s)")
    parsed_origins = [urlsplit(origin) for origin in origins]
    if any(
        origin.scheme != "https" or not origin.netloc or origin.path
        or origin.query or origin.fragment
        for origin in parsed_origins
    ):
        raise RuntimeError("ALLOWED_ORIGINS must contain HTTPS origins")