"""Redis cache service — balance caching with read-through pattern."""

import logging
from typing import Optional

import redis.asyncio as redis

from app.config import settings

logger = logging.getLogger("sentinelclear.cache")

_pool: Optional[redis.Redis] = None

BALANCE_PREFIX = "balance:"
BALANCE_TTL = 300  # 5 minutes


async def connect() -> None:
    """Initialize the Redis connection pool."""
    global _pool
    try:
        _pool = redis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=5,
        )
        await _pool.ping()
        logger.info("Connected to Redis")
    except Exception as exc:
        logger.warning("Redis connection failed (caching disabled): %s", exc)
        _pool = None


async def disconnect() -> None:
    """Close the Redis connection pool."""
    global _pool
    if _pool:
        await _pool.close()
    _pool = None


async def is_healthy() -> bool:
    """Check if Redis is reachable."""
    if _pool is None:
        return False
    try:
        return await _pool.ping()
    except Exception:
        return False


async def get_cached_balance(account_id: str) -> Optional[float]:
    """Retrieve cached balance for an account, or None if miss."""
    if _pool is None:
        return None
    try:
        value = await _pool.get(f"{BALANCE_PREFIX}{account_id}")
        if value is not None:
            logger.debug("Cache HIT for balance:%s", account_id)
            return float(value)
        logger.debug("Cache MISS for balance:%s", account_id)
        return None
    except Exception as exc:
        logger.warning("Redis get failed: %s", exc)
        return None


async def set_cached_balance(account_id: str, balance: float) -> None:
    """Write balance to cache with TTL."""
    if _pool is None:
        return
    try:
        await _pool.set(f"{BALANCE_PREFIX}{account_id}", str(balance), ex=BALANCE_TTL)
    except Exception as exc:
        logger.warning("Redis set failed: %s", exc)


async def invalidate_balance(account_id: str) -> None:
    """Remove a balance from cache (called after transfers)."""
    if _pool is None:
        return
    try:
        await _pool.delete(f"{BALANCE_PREFIX}{account_id}")
    except Exception as exc:
        logger.warning("Redis delete failed: %s", exc)
