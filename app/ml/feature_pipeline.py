"""Real feature pipeline - extracts ML features from actual transfer history."""

import json
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Transfer
from app.services import cache as redis_cache

logger = logging.getLogger("sentinelclear.ml.features")

FEATURE_CACHE_TTL = 60  # seconds


async def extract_features_for_account(db: AsyncSession, account_id: str) -> dict:
    """Query real transfer history and compute ML features for an account.

    Returns a dict with:
        txn_count_30d, volume_30d, avg_txn_amount_30d, max_txn_amount_30d,
        unique_recipients_30d, flagged_ratio_90d, velocity_per_day
    """
    # Check Redis cache first
    cache_key = f"risk_profile:{account_id}"
    if redis_cache._pool:
        try:
            cached = await redis_cache._pool.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    thirty_days_ago = now - timedelta(days=30)
    ninety_days_ago = now - timedelta(days=90)

    # 30-day aggregate stats
    stmt_30d = select(
        func.count(Transfer.id),
        func.coalesce(func.sum(Transfer.amount), 0.0),
        func.coalesce(func.avg(Transfer.amount), 0.0),
        func.coalesce(func.max(Transfer.amount), 0.0),
    ).where(
        and_(
            Transfer.sender_account_id == account_id,
            Transfer.status == "COMPLETED",
            Transfer.created_at >= thirty_days_ago,
        )
    )
    result_30d = await db.execute(stmt_30d)
    row = result_30d.first()
    txn_count_30d = row[0] or 0
    volume_30d = float(row[1])
    avg_txn_amount_30d = float(row[2])
    max_txn_amount_30d = float(row[3])

    # Unique recipients in 30 days
    stmt_recipients = select(
        func.count(func.distinct(Transfer.receiver_account_id))
    ).where(
        and_(
            Transfer.sender_account_id == account_id,
            Transfer.status == "COMPLETED",
            Transfer.created_at >= thirty_days_ago,
        )
    )
    result_recipients = await db.execute(stmt_recipients)
    unique_recipients_30d = result_recipients.scalar() or 0

    # Flagged ratio in 90 days
    stmt_total_90d = select(func.count(Transfer.id)).where(
        and_(
            Transfer.sender_account_id == account_id,
            Transfer.created_at >= ninety_days_ago,
        )
    )
    result_total_90d = await db.execute(stmt_total_90d)
    total_90d = result_total_90d.scalar() or 0

    stmt_flagged_90d = select(func.count(Transfer.id)).where(
        and_(
            Transfer.sender_account_id == account_id,
            Transfer.status == "FLAGGED",
            Transfer.created_at >= ninety_days_ago,
        )
    )
    result_flagged_90d = await db.execute(stmt_flagged_90d)
    flagged_90d = result_flagged_90d.scalar() or 0

    flagged_ratio_90d = (flagged_90d / total_90d) if total_90d > 0 else 0.0

    # Velocity per day (txns per day over 30 days)
    velocity_per_day = txn_count_30d / 30.0

    features = {
        "txn_count_30d": txn_count_30d,
        "volume_30d": round(volume_30d, 2),
        "avg_txn_amount_30d": round(avg_txn_amount_30d, 2),
        "max_txn_amount_30d": round(max_txn_amount_30d, 2),
        "unique_recipients_30d": unique_recipients_30d,
        "flagged_ratio_90d": round(flagged_ratio_90d, 4),
        "velocity_per_day": round(velocity_per_day, 4),
    }

    # Cache in Redis
    if redis_cache._pool:
        try:
            await redis_cache._pool.set(
                cache_key, json.dumps(features), ex=FEATURE_CACHE_TTL
            )
        except Exception:
            pass

    return features
