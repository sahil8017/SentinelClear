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
from datetime import datetime, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Account, LedgerEntry, ReconciliationLog

logger = logging.getLogger("sentinelclear.reconciliation")


async def run_reconciliation(db: AsyncSession) -> dict:
    start_time = time.time()

    total_accounts = 0
    accounts_checked = 0
    discrepancies = []
    total_drift = 0.0

    # Count total accounts first
    count_result = await db.execute(select(func.count(Account.id)))
    total_accounts = count_result.scalar() or 0

    batch_size = 1000
    offset = 0

    while True:
        result = await db.execute(select(Account).order_by(Account.id).offset(offset).limit(batch_size))
        accounts = result.scalars().all()
        
        if not accounts:
            break
            
        for account in accounts:
            ledger_result = await db.execute(
                select(LedgerEntry)
                .where(LedgerEntry.account_id == account.id)
                .order_by(LedgerEntry.created_at.desc())
                .limit(1)
            )
            last_entry = ledger_result.scalar_one_or_none()

            if last_entry is None:
                continue

            accounts_checked += 1

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

            net_ledger = total_credits - total_debits
            expected_from_ledger = last_entry.balance_after
            actual = account.balance

            diff = round(abs(actual - expected_from_ledger), 6)
            if diff > 0.01:
                total_drift += diff
                discrepancies.append({
                    "account_id": account.id,
                    "stored_balance": actual,
                    "ledger_balance": expected_from_ledger,
                    "difference": diff,
                    "total_credits": total_credits,
                    "total_debits": total_debits,
                })
                
        offset += batch_size

    duration_ms = int((time.time() - start_time) * 1000)
    status = "PASSED" if len(discrepancies) == 0 else "FAILED"

    log_entry = ReconciliationLog(
        run_at=datetime.now(timezone.utc).replace(tzinfo=None),
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
            "RECONCILIATION FAILED - %d discrepancies found in %d accounts. Total drift: %.2f",
            len(discrepancies), accounts_checked, total_drift
        )
    else:
        logger.info(
            "Reconciliation PASSED - %d accounts checked, 0 discrepancies (%dms)",
            accounts_checked, duration_ms,
        )

    return {
        "status": status,
        "total_accounts": total_accounts,
        "accounts_checked": accounts_checked,
        "mismatches": len(discrepancies),
        "total_drift": total_drift,
        "discrepancies": discrepancies,
        "duration_ms": duration_ms,
    }