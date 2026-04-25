"""UPI Safety Rules Service — implements RBI/NPCI mandated safety checks.

Four safety layers:
1. Transaction Pause   — P2P transfers > ₹10K paused unless whitelisted
2. Vulnerable Group    — Age ≥70 or disabled + amount > ₹50K → guardian approval
3. Emergency Kill Switch — Instant freeze of all outgoing payments
4. Annual Receiving Limit — ₹25L cap on annual inbound credits
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


async def check_annual_receiving_limit(
    db: AsyncSession,
    receiver_account: Account,
    amount: float,
) -> dict:
    """Rule 4: Annual Receiving Limit — ₹25 Lakhs.

    Check if the receiving account has already received more than
    the annual limit in the current fiscal year. If so, the account
    is frozen and no further credits are allowed.
    """
    amount = float(amount)
    current_fy = _current_fy()

    # Auto-reset if FY has rolled over
    if receiver_account.annual_received_fy != current_fy:
        receiver_account.annual_received = 0.0
        receiver_account.annual_received_fy = current_fy
        receiver_account.is_frozen = False

    if receiver_account.is_frozen:
        return {
            "blocked": True,
            "reason": "ANNUAL_LIMIT_FROZEN",
            "detail": (
                f"Receiving account has been frozen — annual receiving limit of "
                f"₹{settings.UPI_ANNUAL_RECEIVING_LIMIT:,.0f} exceeded. "
                f"The account holder must visit their bank to explain the source of funds."
            ),
        }

    projected = float(receiver_account.annual_received) + amount
    if projected > settings.UPI_ANNUAL_RECEIVING_LIMIT:
        # Freeze the account
        receiver_account.is_frozen = True
        logger.warning(
            "Account %s frozen — annual receiving limit breached (projected: ₹%.2f)",
            receiver_account.id, projected,
        )
        return {
            "blocked": True,
            "reason": "ANNUAL_LIMIT_EXCEEDED",
            "detail": (
                f"This transaction would push the receiving account's annual credits to "
                f"₹{projected:,.0f}, exceeding the ₹{settings.UPI_ANNUAL_RECEIVING_LIMIT:,.0f} limit. "
                f"The receiving account has been frozen pending bank verification."
            ),
        }

    return {"blocked": False}


async def check_transaction_pause(
    db: AsyncSession,
    user: User,
    receiver_account_id: str,
    amount: float,
) -> dict:
    """Rule 1: Transaction Pause — transfers > ₹10K paused.

    Does NOT apply if:
    - The receiver is whitelisted by the sender
    - The amount is below the threshold
    """
    if amount <= settings.UPI_PAUSE_THRESHOLD:
        return {"pause": False}

    # Check whitelist
    result = await db.execute(
        select(WhitelistedContact).where(
            WhitelistedContact.user_id == user.id,
            WhitelistedContact.contact_account_id == receiver_account_id,
        )
    )
    whitelisted = result.scalar_one_or_none()
    if whitelisted:
        logger.info(
            "Transfer > ₹10K to whitelisted contact %s — pause bypassed",
            receiver_account_id,
        )
        return {"pause": False}

    return {
        "pause": True,
        "reason": "TRANSACTION_PAUSE",
        "detail": (
            f"Transactions exceeding ₹{settings.UPI_PAUSE_THRESHOLD:,.0f} require explicit "
            f"confirmation. Please verify this payment is legitimate and confirm to proceed."
        ),
        "cooldown_seconds": settings.UPI_PAUSE_COOLDOWN_SECONDS,
    }


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


async def update_annual_received(
    receiver_account: Account,
    amount: float,
) -> None:
    """Increment the annual received tally after a successful transfer."""
    amount = float(amount)
    current_fy = _current_fy()
    if receiver_account.annual_received_fy != current_fy:
        receiver_account.annual_received = 0.0
        receiver_account.annual_received_fy = current_fy
    receiver_account.annual_received = float(receiver_account.annual_received) + amount
