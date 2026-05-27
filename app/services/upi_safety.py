"""UPI Safety Rules Service — implements RBI/NPCI mandated safety checks.

Active safety layers:
1. Vulnerable Group    — Age ≥70 or disabled + amount > ₹50K → guardian approval
2. Emergency Kill Switch — Instant freeze of all outgoing payments
"""

import logging
from datetime import datetime, date

from sqlalchemy import select, func, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Account, User, WhitelistedContact, Transfer

logger = logging.getLogger("upi_safety")


def _current_fy() -> str:
    """Return the current Indian fiscal year string, e.g. '2025-26'."""
    today = date.today()
    if today.month >= 4:
        return f"{today.year}-{str(today.year + 1)[2:]}"
    else:
        return f"{today.year - 1}-{str(today.year)[2:]}"


def _compute_age(dob: date) -> int:
    """Compute age in completed years from date of birth."""
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


async def check_kill_switch(user: User) -> dict:
    """Rule 3: Emergency Kill Switch.

    If the user has activated the kill switch, ALL outgoing UPI
    payments are instantly blocked.
    """
    if user.kill_switch_active:
        return {
            "blocked": True,
            "reason": "EMERGENCY_KILL_SWITCH",
            "detail": (
                "All outgoing payments have been suspended via Emergency Kill Switch. "
                "Deactivate the kill switch from UPI Safety settings to resume transactions."
            ),
        }
    return {"blocked": False}



async def check_vulnerable_group(
    user: User,
    amount: float,
) -> dict:
    """Rule 2: Enhanced Security for Vulnerable Groups.

    For users aged ≥70 or with disabilities, transactions above
    ₹50,000 require approval from their designated trusted person.
    """
    if amount <= settings.UPI_VULNERABLE_THRESHOLD:
        return {"guardian_required": False}

    is_elderly = False
    if user.date_of_birth:
        age = _compute_age(user.date_of_birth)
        is_elderly = age >= settings.UPI_VULNERABLE_AGE

    is_vulnerable = is_elderly or user.is_disabled

    if not is_vulnerable:
        return {"guardian_required": False}

    if not user.trusted_person_id:
        return {
            "guardian_required": True,
            "blocked": True,
            "reason": "NO_GUARDIAN_CONFIGURED",
            "detail": (
                "Your account requires a trusted person for high-value transactions "
                f"(above ₹{settings.UPI_VULNERABLE_THRESHOLD:,.0f}). "
                "Please configure a trusted person in your UPI Safety settings."
            ),
        }

    return {
        "guardian_required": True,
        "blocked": False,
        "reason": "GUARDIAN_APPROVAL_REQUIRED",
        "detail": (
            f"Transactions above ₹{settings.UPI_VULNERABLE_THRESHOLD:,.0f} require approval "
            f"from your designated trusted person before the payment is processed."
        ),
        "trusted_person_id": user.trusted_person_id,
    }


