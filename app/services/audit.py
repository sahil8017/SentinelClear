"""Tamper-evident audit log service — SHA-256 chained entries."""

import hashlib
import json
from datetime import datetime

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog

GENESIS_HASH = "0" * 64  # The hash used when there is no previous entry


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
    # Get the last entry's hash
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.id.desc()).limit(1)
    )
    last_entry = result.scalar_one_or_none()
    previous_hash = last_entry.current_hash if last_entry else GENESIS_HASH

    details_json = json.dumps(details_dict, sort_keys=True)
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

    Returns a dict with keys: intact (bool), message (str),
    total_entries (int), tamper_position (int | None).
    """
    result = await db.execute(select(AuditLog).order_by(AuditLog.id.asc()))
    entries = result.scalars().all()

    if not entries:
        return {
            "intact": True,
            "message": "No audit entries yet — chain is trivially intact ✅",
            "total_entries": 0,
            "tamper_position": None,
        }

    expected_prev = GENESIS_HASH
    for entry in entries:
        # Check previous_hash linkage
        if entry.previous_hash != expected_prev:
            return {
                "intact": False,
                "message": f"Tamper detected at log #{entry.id} ❌ — previous_hash mismatch",
                "total_entries": len(entries),
                "tamper_position": entry.id,
            }

        # Recompute current_hash
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
                "message": f"Tamper detected at log #{entry.id} ❌ — hash mismatch",
                "total_entries": len(entries),
                "tamper_position": entry.id,
            }

        expected_prev = entry.current_hash

    return {
        "intact": True,
        "message": f"Chain intact ✅ — all {len(entries)} entries verified",
        "total_entries": len(entries),
        "tamper_position": None,
    }
