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

    # ── Fraud ──
    FRAUD_AMOUNT_THRESHOLD: float = 50_000.0

    # ── Redis ──
    REDIS_URL: str = "redis://redis:6379/0"

    # ── Sarvam AI ──
    SARVAM_API_KEY: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
