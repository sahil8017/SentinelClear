"""Async SQLAlchemy engine & session factory."""

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

async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def get_read_db() -> AsyncSession:
    async with AsyncSessionLocalRead() as session:
        try:
            yield session
        finally:
            await session.close()
