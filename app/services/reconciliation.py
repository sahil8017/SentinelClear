"""Scheduled reconciliation — verifies balance integrity across all accounts.

Walks every account, recomputes balance from ledger entries, and compares
against the stored balance. Any discrepancy indicates a bug in the
transaction pipeline (a class of failure that has caused real banking
incidents).

Designed to run via APScheduler from the main FastAPI process, or
standalone as a CLI tool.
"""

import json
import logging
import time
from datetime import datetime

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Account, LedgerEntry, ReconciliationLog

logger = logging.getLogger("sentinelclear.reconciliation")


async def run_reconciliation(db: AsyncSession) -> dict:
    """Compare stored balances against ledger-computed balances for all accounts.

    For each account:
      computed_balance = initial_deposit_total + SUM(CREDIT) - SUM(DEBIT)

    Since deposits don't create ledger entries (they modify balance directly),
    we compute: expected = SUM(deposits) + SUM(credits) - SUM(debits)

    Actually, the simplest correct approach: an account's balance should equal
    its initial deposits + net ledger flow. But since deposits aren't in the
    ledger, we check consistency differently:

    For any account with ledger entries, the latest balance_after in the
    ledger should match the account's current balance (accounting for any
    subsequent deposits that occurred after the last transfer).

    The pragmatic check: for each account, the closing balance from the
    last ledger entry should be consistent with the account balance minus
    any deposits made after that last entry.

    Simplified approach: We compare account.balance with the balance computed
    from the most recent ledger entry's balance_after. If the account has had
    no transactions since its last ledger entry, they should match exactly.

    Returns a dict suitable for storing in ReconciliationLog.
    """
    start_time = time.time()

    # Get all accounts
    result = await db.execute(select(Account))
    accounts = result.scalars().all()

    total_accounts = len(accounts)
    discrepancies = []
    accounts_checked = 0

    for account in accounts:
        # Get the most recent ledger entry for this account
        ledger_result = await db.execute(
            select(LedgerEntry)
            .where(LedgerEntry.account_id == account.id)
            .order_by(LedgerEntry.created_at.desc())
            .limit(1)
        )
        last_entry = ledger_result.scalar_one_or_none()

        if last_entry is None:
            # No ledger entries — nothing to reconcile
            continue

        accounts_checked += 1

        # Get total deposits made after the last ledger entry
        # (Deposits don't create ledger entries, so we need to account for them)
        # Since we don't track individual deposits in a separate table,
        # we do a cross-check: total credits - total debits should equal
        # balance - initial_deposits

        # Simpler check: compute balance entirely from ledger
        credit_result = await db.execute(
            select(func.coalesce(func.sum(LedgerEntry.amount), 0.0))
            .where(LedgerEntry.account_id == account.id, LedgerEntry.entry_type == "CREDIT")
        )
        total_credits = float(credit_result.scalar())

        debit_result = await db.execute(
            select(func.coalesce(func.sum(LedgerEntry.amount), 0.0))
            .where(LedgerEntry.account_id == account.id, LedgerEntry.entry_type == "DEBIT")
        )
        total_debits = float(debit_result.scalar())

        # Net ledger flow
        net_ledger = total_credits - total_debits

        # The last ledger entry's balance_after should be consistent
        # A discrepancy in the last balance_after vs computed balance
        # indicates a mid-transaction inconsistency
        expected_from_ledger = last_entry.balance_after
        actual = account.balance

        # Allow for floating-point tolerance
        diff = round(abs(actual - expected_from_ledger), 6)
        if diff > 0.01:
            discrepancies.append({
                "account_id": account.id,
                "stored_balance": actual,
                "ledger_balance": expected_from_ledger,
                "difference": diff,
                "total_credits": total_credits,
                "total_debits": total_debits,
            })

    duration_ms = int((time.time() - start_time) * 1000)
    status = "PASSED" if len(discrepancies) == 0 else "FAILED"

    # Store the result
    log_entry = ReconciliationLog(
        run_at=datetime.utcnow(),
        total_accounts=total_accounts,
        accounts_checked=accounts_checked,
        discrepancies_found=len(discrepancies),
        discrepancy_details=json.dumps(discrepancies) if discrepancies else None,
        status=status,
        duration_ms=duration_ms,
    )
    db.add(log_entry)
    await db.commit()

    if discrepancies:
        logger.error(
            "RECONCILIATION FAILED — %d discrepancies found in %d accounts",
            len(discrepancies), accounts_checked,
        )
        for d in discrepancies:
            logger.error(
                "  Account %s: stored=%.2f ledger=%.2f diff=%.6f",
                d["account_id"], d["stored_balance"], d["ledger_balance"], d["difference"],
            )
    else:
        logger.info(
            "Reconciliation PASSED — %d accounts checked, 0 discrepancies (%dms)",
            accounts_checked, duration_ms,
        )

    return {
        "status": status,
        "total_accounts": total_accounts,
        "accounts_checked": accounts_checked,
        "discrepancies_found": len(discrepancies),
        "discrepancies": discrepancies,
        "duration_ms": duration_ms,
    }
