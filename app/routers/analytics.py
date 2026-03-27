"""Analytics router — per-account daily statistics."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Account, AccountDailyStat, User
from app.schemas import AnalyticsSummary, DailyStatOut

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/daily/{account_id}", response_model=AnalyticsSummary)
async def get_daily_analytics(
    account_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    days: int = Query(30, ge=1, le=365, description="Number of days to look back"),
):
    """Get daily transaction analytics for an account.

    Returns per-day breakdown of sent/received amounts, transfer counts,
    and flagged transfer counts, populated by the async worker.
    """
    # Verify ownership
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.owner_id == user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found or not yours")

    start_date = date.today() - timedelta(days=days)

    result = await db.execute(
        select(AccountDailyStat)
        .where(
            AccountDailyStat.account_id == account_id,
            AccountDailyStat.stat_date >= start_date,
        )
        .order_by(AccountDailyStat.stat_date.desc())
    )
    stats = result.scalars().all()

    total_sent = sum(s.total_sent for s in stats)
    total_received = sum(s.total_received for s in stats)
    total_transfers = sum(s.transfer_count for s in stats)
    total_flagged = sum(s.flagged_count for s in stats)

    return AnalyticsSummary(
        account_id=account_id,
        period_days=days,
        total_sent=round(total_sent, 2),
        total_received=round(total_received, 2),
        net_flow=round(total_received - total_sent, 2),
        total_transfers=total_transfers,
        total_flagged=total_flagged,
        daily_stats=stats,
    )
