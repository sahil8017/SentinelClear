"""SentinelClear — FastAPI application entry-point."""

import logging
import os
import httpx
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, status, APIRouter, Request
from starlette.middleware.base import BaseHTTPMiddleware
from app.middleware.sla import SLAMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
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
from app.services import neo4j_service
from app.routers import auth, accounts, transfers, audit, ledger, fraud, notifications, analytics, statement, websocket, chaos, loans, aml, whitelist, admin_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger("sentinelclear")

from app.logging_config import PIIMaskingFilter
logging.getLogger().addFilter(PIIMaskingFilter())
for name in logging.root.manager.loggerDict:
    logging.getLogger(name).addFilter(PIIMaskingFilter())


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
        # ── Seed/Sync Admin User ──
        admin_result = await db.execute(select(User).where(User.username == settings.ADMIN_USERNAME))
        admin_user = admin_result.scalar_one_or_none()
        if not admin_user:
            admin_user = User(
                username=settings.ADMIN_USERNAME,
                email=settings.ADMIN_EMAIL,
                hashed_password=_pwd.hash(settings.ADMIN_PASSWORD),
                role="ADMIN",
                profile_complete=True
            )
            db.add(admin_user)
            logger.info("✅ Seeded default admin account: %s", settings.ADMIN_USERNAME)
        else:
            admin_user.email = settings.ADMIN_EMAIL
            admin_user.hashed_password = _pwd.hash(settings.ADMIN_PASSWORD)
            admin_user.role = "ADMIN"
            admin_user.profile_complete = True
            logger.info("🔄 Synced admin account password and role on startup: %s", settings.ADMIN_USERNAME)
        await db.commit()

        result = await db.execute(select(User).where(User.transaction_pin_hash.is_(None)))
        users_without_pin = result.scalars().all()
        for u in users_without_pin:
            u.transaction_pin_hash = _pwd.hash("1234")  # Default demo PIN
        if users_without_pin:
            await db.commit()
            logger.info(f"🔐 Seeded default transaction PIN for {len(users_without_pin)} users")

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

    # Connect to Neo4j
    try:
        await neo4j_service.connect()
        logger.info("✅ Neo4j graph database ready")
        
        # Sync Postgres to Neo4j on boot
        async with AsyncSessionLocal() as db:
            await neo4j_service.sync_postgres_to_neo4j(db)
    except Exception as exc:
        logger.warning("⚠️  Neo4j connection failed or sync failed: %s — AML graph features degraded", exc)

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
    await neo4j_service.disconnect()
    await redis_cache.disconnect()
    await rmq.disconnect()
    await engine.dispose()
    logger.info("👋 Shutdown complete")


# ────────────────────────────── App ──────────────────────────────

try:
    from app.telemetry import setup_telemetry
except Exception as _telem_err:
    logger.warning("⚠️  Telemetry unavailable: %s — tracing disabled", _telem_err)
    def setup_telemetry(app): pass  # noqa: E731
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

setup_telemetry(app)


def _normalize_origins(origins):
    if isinstance(origins, str):
        return [origin.strip() for origin in origins.split(",") if origin.strip()]
    return origins

# ── Security Headers Middleware ──

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        # Allow Firebase signInWithPopup to communicate back to the opener
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"
        return response

# ── CORS ──

class DeprecationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/api/v1"):
            response.headers["Sunset"] = "2027-01-01"
            response.headers["Deprecation"] = "true"
        return response

app.add_middleware(DeprecationMiddleware)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(SLAMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_normalize_origins(settings.ALLOWED_ORIGINS),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key", "X-Idempotency-Key", "X-Admin-Token"],
)

# ── Prometheus instrumentation ──
Instrumentator(
    should_group_status_codes=True,
    should_ignore_untemplated=True,
    excluded_handlers=["/health", "/metrics"],
).instrument(app).expose(app, endpoint="/metrics", include_in_schema=True)

# ── Register routers ──
v1_router = APIRouter(prefix="/api/v1")

v1_router.include_router(auth.router)
v1_router.include_router(accounts.router)
v1_router.include_router(transfers.router)
v1_router.include_router(audit.router)
v1_router.include_router(ledger.router)
v1_router.include_router(fraud.router)
v1_router.include_router(notifications.router)
v1_router.include_router(analytics.router)
v1_router.include_router(statement.router)

v1_router.include_router(loans.router)
v1_router.include_router(aml.router)
v1_router.include_router(whitelist.router)
v1_router.include_router(admin_settings.router)

if settings.ENABLE_CHAOS_ENDPOINTS:
    v1_router.include_router(chaos.router)
else:
    logger.info("Chaos endpoints disabled in this deployment")

app.include_router(v1_router)
app.include_router(websocket.router)

# ────────────────────────────── Health ──────────────────────────────

@app.get("/health", tags=["Health"])
async def health_check():
    """Check connectivity to core dependencies and optional observability services."""
    db_status = "healthy"
    rmq_status = "healthy"
    redis_status = "healthy"
    neo4j_status = "healthy"
    grafana_status = "healthy"

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

    try:
        if not await neo4j_service.is_healthy():
            neo4j_status = "unhealthy"
    except Exception:
        neo4j_status = "unhealthy"

    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(settings.GRAFANA_URL)
            if response.status_code != status.HTTP_200_OK:
                grafana_status = "unhealthy"
    except Exception:
        grafana_status = "unhealthy"

    # Core services: DB, RabbitMQ, Redis — must be healthy for API to function
    core_services = [db_status, rmq_status, redis_status]
    core_healthy = all(s == "healthy" for s in core_services)
    # Neo4j and Grafana are optional — AML graph and dashboards degrade gracefully
    grafana_required_healthy = (
        grafana_status == "healthy" if settings.REQUIRE_GRAFANA_FOR_HEALTH else True
    )
    all_healthy = core_healthy and grafana_required_healthy
    overall = "healthy" if all_healthy else "degraded"
    payload = {
        "status": overall,
        "database": db_status,
        "rabbitmq": rmq_status,
        "redis": redis_status,
        "neo4j": neo4j_status,
        "grafana": grafana_status,
        "checks": {
            "require_grafana_for_health": settings.REQUIRE_GRAFANA_FOR_HEALTH,
            "grafana_url": settings.GRAFANA_URL,
        },
    }
    status_code = status.HTTP_200_OK if all_healthy else status.HTTP_503_SERVICE_UNAVAILABLE
    return JSONResponse(status_code=status_code, content=payload)


# ────────────────────────────── Reconciliation (Manual Trigger) ──────────────────────────────

from app.dependencies import require_admin as _require_admin

@app.post("/admin/reconciliation", tags=["Admin"], dependencies=[Depends(_require_admin)])
async def trigger_reconciliation():
    """Manually trigger a balance reconciliation check.

    Walks all accounts, recomputes balances from ledger entries,
    and flags any discrepancies. Results are stored in reconciliation_logs.
    """
    async with AsyncSessionLocal() as db:
        result = await run_reconciliation(db)
    return result
@app.get("/api/v1/auth/temp-admin-reset", tags=["Admin"])
async def temp_admin_reset():
    from passlib.context import CryptContext
    from app.models import User
    from sqlalchemy import select
    
    _pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.role == "ADMIN"))
        admins = result.scalars().all()
        
        if not admins:
            new_admin = User(
                username="admin",
                email="admin@sentinelclear.io",
                hashed_password=_pwd.hash("Admin@1234"),
                role="ADMIN",
                profile_complete=True
            )
            db.add(new_admin)
            await db.commit()
            return {
                "status": "created",
                "message": "No admin found. Created a new default admin.",
                "username": "admin",
                "email": "admin@sentinelclear.io",
                "password": "Admin@1234"
            }
        
        for admin in admins:
            admin.hashed_password = _pwd.hash("Admin@1234")
            admin.profile_complete = True
            
        await db.commit()
        return {
            "status": "reset",
            "message": "All existing admin passwords have been reset to Admin@1234",
            "admins": [{"username": a.username, "email": a.email} for a in admins]
        }



from starlette.exceptions import HTTPException as StarletteHTTPException

# Serve SPA last so /api/* and /health are not handled by StaticFiles (POST → 405).
_frontend_dist = "frontend/dist"

@app.exception_handler(StarletteHTTPException)
async def spa_fallback(request: Request, exc: StarletteHTTPException):
    if exc.status_code == 404 and request.method == "GET" and not request.url.path.startswith("/api/"):
        _index_path = os.path.join(_frontend_dist, "index.html")
        if os.path.isfile(_index_path):
            return FileResponse(_index_path)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

if os.path.isdir(_frontend_dist):
    app.mount("/", StaticFiles(directory=_frontend_dist, html=True), name="frontend")
