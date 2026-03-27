"""Tamper-evident audit log service — SHA-256 chained entries."""

import hashlib
import json
from datetime import datetime

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog

GENESIS_HASH = "0" * 64


def _compute_hash(previous_hash: str, transfer_id: str, action: str, details: str, timestamp: str) -> str:
    """Compute SHA-256 of the concatenation of all fields + previous hash."""
    raw = f"{previous_hash}|{transfer_id}|{action}|{details}|{timestamp}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def create_audit_entry(
    db: AsyncSession,
    transfer_id: str,
    action: str,
    details_dict: dict,
) -> AuditLog:
    """Append a new hash-chained entry to the audit log."""
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.id.desc()).limit(1)
    )
    last_entry = result.scalar_one_or_none()
    previous_hash = last_entry.current_hash if last_entry else GENESIS_HASH

    details_json = json.dumps(details_dict, sort_keys=True, default=str)
    now = datetime.utcnow()
    timestamp_str = now.isoformat()

    current_hash = _compute_hash(previous_hash, transfer_id, action, details_json, timestamp_str)

    entry = AuditLog(
        transfer_id=transfer_id,
        action=action,
        details=details_json,
        previous_hash=previous_hash,
        current_hash=current_hash,
        created_at=now,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


async def verify_chain(db: AsyncSession) -> dict:
    """Walk the entire audit log and verify every SHA-256 link.

    Returns:
        {
            "intact": bool,
            "total_entries": int,
            "entries_checked": int,
            "first_tampered_at": int | None,
            "message": str,
        }
    """
    result = await db.execute(select(AuditLog).order_by(AuditLog.id.asc()))
    entries = result.scalars().all()

    if not entries:
        return {
            "intact": True,
            "total_entries": 0,
            "entries_checked": 0,
            "first_tampered_at": None,
            "message": "No audit entries yet — chain is trivially intact",
        }

    expected_prev = GENESIS_HASH
    checked = 0

    for entry in entries:
        checked += 1

        if entry.previous_hash != expected_prev:
            return {
                "intact": False,
                "total_entries": len(entries),
                "entries_checked": checked,
                "first_tampered_at": entry.id,
                "message": f"Tamper detected at entry #{entry.id} — previous_hash linkage broken",
            }

        recomputed = _compute_hash(
            entry.previous_hash,
            entry.transfer_id,
            entry.action,
            entry.details,
            entry.created_at.isoformat(),
        )
        if entry.current_hash != recomputed:
            return {
                "intact": False,
                "total_entries": len(entries),
                "entries_checked": checked,
                "first_tampered_at": entry.id,
                "message": f"Tamper detected at entry #{entry.id} — content hash mismatch",
            }

        expected_prev = entry.current_hash

    return {
        "intact": True,
        "total_entries": len(entries),
        "entries_checked": checked,
        "first_tampered_at": None,
        "message": f"Chain intact — all {len(entries)} entries verified",
    }
