"""Idempotency key service — prevents duplicate transaction processing."""

import json
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import IdempotencyKey

IDEMPOTENCY_TTL_HOURS = 24


async def check_or_create_key(
    db: AsyncSession,
    key: str,
    user_id: int,
) -> dict:
    """Check idempotency key state and return appropriate action.

    Returns:
        {"action": "new"} — key doesn't exist, created with PENDING status
        {"action": "replay", "response_code": int, "response_body": str} — cached response
        {"action": "conflict"} — key exists but still PENDING (concurrent request)
    """
    result = await db.execute(
        select(IdempotencyKey).where(IdempotencyKey.key == key)
    )
    existing = result.scalar_one_or_none()

    if existing is None:
        entry = IdempotencyKey(key=key, user_id=user_id, status="PENDING")
        db.add(entry)
        await db.flush()
        return {"action": "new"}

    # Check TTL — expired keys are treated as new
    if existing.created_at < datetime.utcnow() - timedelta(hours=IDEMPOTENCY_TTL_HOURS):
        await db.delete(existing)
        await db.flush()
        entry = IdempotencyKey(key=key, user_id=user_id, status="PENDING")
        db.add(entry)
        await db.flush()
        return {"action": "new"}

    if existing.status == "DONE":
        return {
            "action": "replay",
            "response_code": existing.response_code,
            "response_body": existing.response_body,
        }

    return {"action": "conflict"}


async def mark_done(
    db: AsyncSession,
    key: str,
    response_code: int,
    response_body: dict,
) -> None:
    """Mark an idempotency key as DONE and cache the response."""
    result = await db.execute(
        select(IdempotencyKey).where(IdempotencyKey.key == key)
    )
    entry = result.scalar_one_or_none()
    if entry:
        entry.status = "DONE"
        entry.response_code = response_code
        entry.response_body = json.dumps(response_body)
        await db.flush()
