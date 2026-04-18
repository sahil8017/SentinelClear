"""SentinelClear — FastAPI application entry-point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from passlib.context import CryptContext
from sqlalchemy import text, select

from app.config import settings
from app.database import engine, AsyncSessionLocal
from app.models import Base, User
from app.services import rabbitmq as rmq
from app.services import cache as redis_cache
from app.services.fraud import seed_rule_configs
from app.services.reconciliation import run_reconciliation
from app.routers import auth, accounts, transfers, audit, ledger, fraud, notifications, analytics, statement, websocket, chaos, loans, aml, whitelist, admin_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger("sentinelclear")

# APScheduler for background reconciliation
_scheduler = None


# ────────────────────────────── Lifespan ──────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown hooks."""
    # Migrations are handled exclusively by Alembic in the docker/system entrypoint.
    # Base.metadata.create_all is removed to prevent collisions with existing types.
    logger.info("✅ Persistence layer active")

    # Seed fraud rule configs with defaults
    async with AsyncSessionLocal() as db:
        await seed_rule_configs(db)
    logger.info("✅ Fraud rule engine ready")

    # Seed default transaction PINs for demo users who don't have one
    _pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.transaction_pin_hash.is_(None)))
        users_without_pin = result.scalars().all()
        for u in users_without_pin:
            u.transaction_pin_hash = _pwd.hash("1234")  # Default demo PIN
        if users_without_pin:
            await db.commit()
            logger.info(f"🔐 Seeded default transaction PIN for {len(users_without_pin)} users (PIN: 1234)")

    # ML Loan Eligibility Model
    from app.services.ml_loan_service import load_model as load_loan_model
    if load_loan_model():
        logger.info("✅ Loan eligibility ML model loaded — credit scoring active")
    else:
        logger.warning("⚠️  Loan eligibility model not found — heuristic scoring mode")

    # Connect to RabbitMQ
    await rmq.connect()
    logger.info("✅ RabbitMQ publisher ready")

    # Connect to Redis
    await redis_cache.connect()
    logger.info("✅ Redis cache ready")

    # Start scheduled reconciliation
    global _scheduler
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        _scheduler = AsyncIOScheduler()

        async def _scheduled_reconciliation():
            logger.info("🔄 Running scheduled reconciliation...")
            try:
                async with AsyncSessionLocal() as db:
                    result = await run_reconciliation(db)
                    logger.info("Reconciliation %s — %d accounts, %d discrepancies",
                                result["status"], result["accounts_checked"],
                                result["discrepancies_found"])
            except Exception as exc:
                logger.error("Reconciliation failed: %s", exc)

        _scheduler.add_job(
            _scheduled_reconciliation,
            "interval",
            hours=settings.RECONCILIATION_INTERVAL_HOURS,
            id="reconciliation",
            name="Balance Reconciliation",
        )
        _scheduler.start()
        logger.info("✅ Reconciliation scheduler started (every %dh)",
                     settings.RECONCILIATION_INTERVAL_HOURS)
    except Exception as exc:
        logger.warning("⚠️  APScheduler not available: %s — reconciliation disabled", exc)

    yield  # ← app runs here

    # Shutdown
    if _scheduler:
        _scheduler.shutdown(wait=False)
    await redis_cache.disconnect()
    await rmq.disconnect()
    await engine.dispose()
    logger.info("👋 Shutdown complete")


# ────────────────────────────── App ──────────────────────────────

app = FastAPI(
    title="SentinelClear",
    description=(
        "Production-grade banking backend with double-entry ledger, "
        "idempotent transactions, rule-based fraud detection, hash-chained audit logs, "
        "Redis caching, rate limiting, PDF statement generation, and event-driven notifications."
    ),
    version="4.0.0",
    lifespan=lifespan,
)


def _normalize_origins(origins):
    if isinstance(origins, str):
        return [origin.strip() for origin in origins.split(",") if origin.strip()]
    return origins

# ── CORS ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=_normalize_origins(settings.ALLOWED_ORIGINS),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
app.include_router(fraud.router)
app.include_router(notifications.router)
app.include_router(analytics.router)
app.include_router(statement.router)
app.include_router(websocket.router)
app.include_router(loans.router)
app.include_router(aml.router)
app.include_router(whitelist.router)
app.include_router(admin_settings.router)

if settings.ENABLE_CHAOS_ENDPOINTS:
    app.include_router(chaos.router)
else:
    logger.info("Chaos endpoints disabled in this deployment")


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


# ────────────────────────────── Reconciliation (Manual Trigger) ──────────────────────────────

@app.post("/admin/reconciliation", tags=["Admin"])
async def trigger_reconciliation():
    """Manually trigger a balance reconciliation check.

    Walks all accounts, recomputes balances from ledger entries,
    and flags any discrepancies. Results are stored in reconciliation_logs.
    """
    from app.schemas import ReconciliationOut
    async with AsyncSessionLocal() as db:
        result = await run_reconciliation(db)
    return result
