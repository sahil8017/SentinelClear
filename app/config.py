"""Centralised application settings — loaded once from .env / environment."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Database ──
    DATABASE_URL: str = "postgresql+asyncpg://sentinel:sentinel_secret_2024@postgres-db:5432/sentinelclear"

    # ── RabbitMQ ──
    RABBITMQ_URL: str = "amqp://sentinel:sentinel_rabbit_2024@rabbitmq:5672/"

    # ── JWT ──
    JWT_SECRET_KEY: str = "sc-jwt-super-secret-key-change-in-production-2024"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60

    # ── Redis ──
    REDIS_URL: str = "redis://redis:6379/0"

    # ── Fraud Detection — Rule Engine Defaults ──
    FRAUD_AMOUNT_THRESHOLD: float = 50_000.0
    FRAUD_VELOCITY_MAX: int = 5             # max transfers per window
    FRAUD_VELOCITY_WINDOW: int = 600        # 10 minutes in seconds
    FRAUD_DAILY_VOLUME_LIMIT: float = 200_000.0
    FRAUD_NEW_ACCOUNT_HOURS: int = 24
    FRAUD_NEW_ACCOUNT_AMOUNT: float = 10_000.0
    FRAUD_NIGHT_START: int = 1              # 1 AM
    FRAUD_NIGHT_END: int = 5                # 5 AM
    FRAUD_RECIPIENT_MAX: int = 3            # max transfers to same recipient
    FRAUD_RECIPIENT_WINDOW: int = 3600      # 1 hour in seconds
    FRAUD_REVIEW_THRESHOLD: float = 0.4     # score >= this → REVIEW
    FRAUD_BLOCK_THRESHOLD: float = 0.7      # score >= this → BLOCK

    # ── Compliance — Maker-Checker ──
    MAKER_CHECKER_THRESHOLD: float = 1_000_000.0

    # ── UPI Safety Rules ──
    UPI_PAUSE_THRESHOLD: float = 10_000.0           # ₹10K — transactions above this are paused
    UPI_PAUSE_COOLDOWN_SECONDS: int = 300            # 5-minute confirmation window
    UPI_VULNERABLE_THRESHOLD: float = 50_000.0       # ₹50K — guardian approval for vulnerable users
    UPI_VULNERABLE_AGE: int = 70                     # Age threshold for vulnerable group
    UPI_ANNUAL_RECEIVING_LIMIT: float = 25_00_000.0  # ₹25 Lakhs annual receiving cap

    # ── Reconciliation ──
    RECONCILIATION_INTERVAL_HOURS: int = 24

    # ── Runtime toggles & security ──
    ENABLE_CHAOS_ENDPOINTS: bool = True
    ADMIN_SECRET_KEY: str = "change-me-in-production"
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:8000"]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
