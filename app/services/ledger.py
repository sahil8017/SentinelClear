"""Double-entry ledger service — every transfer creates DEBIT + CREDIT entries."""

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import LedgerEntry


async def create_double_entry(
    db: AsyncSession,
    transfer_id: str,
    sender_account_id: str,
    receiver_account_id: str,
    amount: float,
    sender_balance_after: float,
    receiver_balance_after: float,
) -> tuple[LedgerEntry, LedgerEntry]:
    """Create paired DEBIT + CREDIT entries atomically.

    Guarantees: sum(DEBIT) == sum(CREDIT) across the entire system.
    """
    debit = LedgerEntry(
        transfer_id=transfer_id,
        account_id=sender_account_id,
        entry_type="DEBIT",
        amount=amount,
        balance_after=sender_balance_after,
    )
    credit = LedgerEntry(
        transfer_id=transfer_id,
        account_id=receiver_account_id,
        entry_type="CREDIT",
        amount=amount,
        balance_after=receiver_balance_after,
    )
    db.add_all([debit, credit])
    await db.flush()
    return debit, credit


async def get_ledger_for_account(
    db: AsyncSession,
    account_id: str,
) -> list[LedgerEntry]:
    """Return all ledger entries for an account, ordered chronologically."""
    result = await db.execute(
        select(LedgerEntry)
        .where(LedgerEntry.account_id == account_id)
        .order_by(LedgerEntry.created_at.asc())
    )
    return result.scalars().all()


async def verify_ledger_balance(db: AsyncSession) -> dict:
    """Verify global ledger integrity: total debits must equal total credits."""
    debit_result = await db.execute(
        select(func.coalesce(func.sum(LedgerEntry.amount), 0.0))
        .where(LedgerEntry.entry_type == "DEBIT")
    )
    total_debits = float(debit_result.scalar())

    credit_result = await db.execute(
        select(func.coalesce(func.sum(LedgerEntry.amount), 0.0))
        .where(LedgerEntry.entry_type == "CREDIT")
    )
    total_credits = float(credit_result.scalar())

    count_result = await db.execute(select(func.count(LedgerEntry.id)))
    total_entries = count_result.scalar()

    difference = round(abs(total_debits - total_credits), 6)
    balanced = difference < 0.01

    return {
        "balanced": balanced,
        "total_debits": round(total_debits, 2),
        "total_credits": round(total_credits, 2),
        "difference": difference,
        "total_entries": total_entries,
        "message": "Ledger balanced ✅ — no money created or destroyed"
        if balanced
        else f"Ledger IMBALANCED ❌ — difference: {difference}",
    }
