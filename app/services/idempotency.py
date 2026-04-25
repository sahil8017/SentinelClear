"""Idempotency key service - prevents duplicate transaction processing using Redis atomic SET NX EX."""

import json
from datetime import datetime, timedelta, timezone

from app.services import cache as redis_cache

IDEMPOTENCY_TTL_SECONDS = 86400


async def check_or_create_key(
    db, # keep signature for compatibility but ignore
    key: str,
    user_id: int,
) -> dict:
    """Check idempotency key state and return appropriate action.
    
    Returns:
        {"action": "new"} - key doesn't exist, created with PENDING status
        {"action": "replay", "response_code": int, "response_body": str} - cached response
        {"action": "conflict"} - key exists but still PENDING (concurrent request)
    """
    if redis_cache._pool is None:
        # fallback if redis is down
        return {"action": "new"}

    redis_key = f"idem:{key}"
    
    is_new = await redis_cache._pool.set(redis_key, "processing", nx=True, ex=IDEMPOTENCY_TTL_SECONDS)
    
    if is_new:
        return {"action": "new"}

    cached = await redis_cache._pool.get(redis_key)
    if cached == "processing":
        return {"action": "conflict"}
        
    try:
        cached_data = json.loads(cached)
        return {
            "action": "replay",
            "response_code": cached_data.get("status_code", 201),
            "response_body": json.dumps(cached_data.get("body", {})),
        }
    except Exception:
        return {"action": "conflict"}


async def mark_done(
    db, # keep signature
    key: str,
    response_code: int,
    response_body: dict,
) -> None:
    """Mark an idempotency key as DONE and cache the response."""
    if redis_cache._pool is None:
        return
        
    redis_key = f"idem:{key}"
    cached_data = {
        "status_code": response_code,
        "body": response_body
    }
    await redis_cache._pool.set(redis_key, json.dumps(cached_data), ex=IDEMPOTENCY_TTL_SECONDS)
