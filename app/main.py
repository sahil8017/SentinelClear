"""SentinelClear — FastAPI application entry-point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator
from sqlalchemy import text

from app.config import settings
from app.database import engine, AsyncSessionLocal
from app.models import Base
from app.services import rabbitmq as rmq
from app.services import cache as redis_cache
from app.services.fraud import load_model as load_fraud_model
from app.routers import auth, accounts, transfers, audit, ledger, ai

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger("sentinelclear")


# ────────────────────────────── Lifespan ──────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown hooks."""
    # Create tables if they don't exist (fallback — Alembic is the primary path)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ Database tables ensured")

    # Load ML fraud detection model (falls back to rule-based if unavailable)
    load_fraud_model()
    logger.info("✅ Fraud detection service ready")

    # Connect to RabbitMQ
    await rmq.connect()
    logger.info("✅ RabbitMQ publisher ready")

    # Connect to Redis
    await redis_cache.connect()
    logger.info("✅ Redis cache ready")

    yield  # ← app runs here

    # Shutdown
    await redis_cache.disconnect()
    await rmq.disconnect()
    await engine.dispose()
    logger.info("👋 Shutdown complete")


# ────────────────────────────── App ──────────────────────────────

app = FastAPI(
    title="SentinelClear",
    description=(
        "Production-grade banking backend with double-entry ledger, "
        "idempotent transactions, ML fraud detection, hash-chained audit logs, "
        "Redis caching, rate limiting, and Sarvam AI integration."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

# ── Prometheus instrumentation ──
Instrumentator(
    should_group_status_codes=True,
    should_ignore_untemplated=True,
    excluded_handlers=["/health", "/metrics"],
).instrument(app).expose(app, endpoint="/metrics", include_in_schema=True)

# ── Register routers ──
app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(transfers.router)
app.include_router(audit.router)
app.include_router(ledger.router)
app.include_router(ai.router)


# ────────────────────────────── Health ──────────────────────────────

@app.get("/health", tags=["Health"])
async def health_check():
    """Check connectivity to PostgreSQL, RabbitMQ, and Redis."""
    db_status = "healthy"
    rmq_status = "healthy"
    redis_status = "healthy"

    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
    except Exception:
        db_status = "unhealthy"

    try:
        if rmq._connection is None or rmq._connection.is_closed:
            rmq_status = "unhealthy"
    except Exception:
        rmq_status = "unhealthy"

    try:
        if not await redis_cache.is_healthy():
            redis_status = "unhealthy"
    except Exception:
        redis_status = "unhealthy"

    all_healthy = all(s == "healthy" for s in [db_status, rmq_status, redis_status])
    overall = "healthy" if all_healthy else "degraded"
    return {
        "status": overall,
        "database": db_status,
        "rabbitmq": rmq_status,
        "redis": redis_status,
    }
