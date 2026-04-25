"""Async SQLAlchemy engine & session factory."""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.config import settings

engine = create_async_engine(
    settings.DATABASE_URL, 
    echo=False, 
    pool_size=20, 
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=1800
)

read_engine = create_async_engine(
    settings.DATABASE_READ_URL, 
    echo=False, 
    pool_size=20, 
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=1800
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
