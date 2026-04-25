"""Tamper-evident audit log service - SHA-256 chained entries."""

import hashlib
import json
from datetime import datetime, timezone

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog

GENESIS_HASH = "0" * 64

def _compute_hash(previous_hash: str, transfer_id: str, action: str, details: str, timestamp: str) -> str:
    raw = f"{previous_hash}|{transfer_id}|{action}|{details}|{timestamp}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

async def create_audit_entry(
    db: AsyncSession,
    transfer_id: str,
    action: str,
    details_dict: dict,
):
    sender = details_dict.get("sender")
    receiver = details_dict.get("receiver")
    
    async def _append_for_account(acct_id, is_sender):
        if not acct_id: return
        
        result = await db.execute(
            select(AuditLog)
            .where(or_(AuditLog.sender_account_id == acct_id, AuditLog.receiver_account_id == acct_id))
            .order_by(AuditLog.id.desc()).limit(1)
        )
        last_entry = result.scalar_one_or_none()
        previous_hash = last_entry.current_hash if last_entry else GENESIS_HASH
        
        details_json = json.dumps(details_dict, sort_keys=True, default=str)
        now_aware = datetime.now(timezone.utc).replace(microsecond=0)
        ts_val = now_aware.strftime("%Y%m%d%H%M%S")
        now_naive = now_aware.replace(tzinfo=None)
        
        current_hash = _compute_hash(previous_hash, transfer_id, action, details_json, ts_val)
        
        entry = AuditLog(
            transfer_id=transfer_id,
            action=action,
            details=details_json,
            previous_hash=previous_hash,
            current_hash=current_hash,
            created_at=now_naive,
            sender_account_id=acct_id if is_sender else None,
            receiver_account_id=acct_id if not is_sender else None,
        )
        db.add(entry)
        await db.flush()

    await _append_for_account(sender, True)
    if receiver and receiver != sender:
        await _append_for_account(receiver, False)

async def verify_chain(db: AsyncSession, account_id: str, page: int = 1, page_size: int = 1000) -> dict:
    offset = (page - 1) * page_size
    result = await db.execute(
        select(AuditLog)
        .where(or_(AuditLog.sender_account_id == account_id, AuditLog.receiver_account_id == account_id))
        .order_by(AuditLog.id.asc())
        .offset(offset)
        .limit(page_size)
    )
    entries = result.scalars().all()

    if not entries:
        return {
            "intact": True,
            "total_entries": 0,
            "entries_checked": 0,
            "first_tampered_at": None,
            "message": "No audit entries in this page",
        }

    expected_prev = GENESIS_HASH
    if offset > 0:
        prev_result = await db.execute(
            select(AuditLog)
            .where(or_(AuditLog.sender_account_id == account_id, AuditLog.receiver_account_id == account_id))
            .order_by(AuditLog.id.asc())
            .offset(offset - 1)
            .limit(1)
        )
        prev_entry = prev_result.scalar_one_or_none()
        if prev_entry:
            expected_prev = prev_entry.current_hash

    checked = 0
    for entry in entries:
        checked += 1

        if entry.previous_hash != expected_prev:
            return {
                "intact": False,
                "total_entries": len(entries),
                "entries_checked": checked,
                "first_tampered_at": entry.id,
                "message": f"Tamper detected at entry #{entry.id} - previous_hash linkage broken",
            }

        ts_val = entry.created_at.strftime("%Y%m%d%H%M%S")
        recomputed = _compute_hash(
            entry.previous_hash,
            entry.transfer_id,
            entry.action,
            entry.details,
            ts_val,
        )
        if entry.current_hash != recomputed:
            return {
                "intact": False,
                "total_entries": len(entries),
                "entries_checked": checked,
                "first_tampered_at": entry.id,
                "message": f"Tamper detected at entry #{entry.id} - content hash mismatch",
            }

        expected_prev = entry.current_hash

    return {
        "intact": True,
        "total_entries": len(entries),
        "entries_checked": checked,
        "first_tampered_at": None,
        "message": f"Chain intact - {len(entries)} entries verified on page {page}",
    }
