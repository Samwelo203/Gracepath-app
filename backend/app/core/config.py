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