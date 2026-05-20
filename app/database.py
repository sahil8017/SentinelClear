from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.config import settings

def get_engine_args(url: str):
    connect_args = {}
    cleaned_url = url
    if "sslmode" in url or "ssl" in url:
        if "?" in url:
            cleaned_url = url.split("?")[0]
        connect_args["ssl"] = True
    return cleaned_url, connect_args

db_url, db_args = get_engine_args(settings.DATABASE_URL)
engine = create_async_engine(
    db_url, 
    echo=False, 
    pool_size=20, 
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=1800,
    connect_args=db_args
)

read_db_url, read_db_args = get_engine_args(settings.DATABASE_READ_URL)
read_engine = create_async_engine(
    read_db_url, 
    echo=False, 
    pool_size=20, 
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=1800,
    connect_args=read_db_args
)

AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
AsyncSessionLocalRead = async_sessionmaker(read_engine, class_=AsyncSession, expire_on_commit=False)

async def check_db_chaos(request: Request = None):
    if request is not None:
        try:
            path = request.url.path
            if "/admin/chaos" in path or "/health" in path:
                return
        except Exception:
            pass

    from app.services.cache import _pool
    if _pool is not None:
        try:
            val = await _pool.get("chaos:db_paused")
            if val == "true":
                import asyncio
                from sqlalchemy.exc import OperationalError
                # Sleep to simulate network timeout
                await asyncio.sleep(5)
                raise OperationalError("Connection timed out (simulated chaos)", params=None, orig=None)
        except OperationalError:
            raise
        except Exception:
            pass

async def get_db(request: Request = None) -> AsyncSession:
    await check_db_chaos(request)
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def get_read_db(request: Request = None) -> AsyncSession:
    await check_db_chaos(request)
    async with AsyncSessionLocalRead() as session:
        try:
            yield session
        finally:
            await session.close()
