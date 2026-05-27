import asyncio
import os
import sys
from decimal import Decimal

# Ensure imports work when run from project root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from passlib.context import CryptContext
from sqlalchemy import select, text

from app.database import AsyncSessionLocal
from app.models import Account, BalanceSnapshot, SystemConfig, User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def seed():
    print("🌱 Starting Database Seed...")
    async with AsyncSessionLocal() as db:
        # Truncate all transactional tables to ensure a clean slate
        print("Truncating tables...")
        await db.execute(text(
            "TRUNCATE TABLE users, accounts, credit_profiles, ledger_entries, "
            "transfers, audit_logs, balance_snapshots, loans CASCADE;"
        ))
        await db.flush()

        # ── System User ────────────────────────────────────────────────────────
        print("Creating system user...")
        system_res = await db.execute(select(User).where(User.username == "system"))
        system_user = system_res.scalar_one_or_none()
        if not system_user:
            system_user = User(
                username="system",
                email="system@sentinelclear.local",
                hashed_password=pwd_context.hash("systempass"),
                role="ADMIN",
                profile_complete=True,
            )
            db.add(system_user)
            await db.flush()

        # ── Treasury Account ───────────────────────────────────────────────────
        TREASURY_ACCOUNT_ID = "00000000-0000-0000-0000-000000000000"
        treasury_res = await db.execute(
            select(Account).where(Account.id == TREASURY_ACCOUNT_ID)
        )
        treasury = treasury_res.scalar_one_or_none()
        if not treasury:
            treasury = Account(
                id=TREASURY_ACCOUNT_ID,
                owner_id=system_user.id,
                account_type="treasury",
                balance=Decimal("1000000000.00"),
            )
            db.add(treasury)
        else:
            treasury.balance = Decimal("1000000000.00")

        # ── Balance Snapshots ──────────────────────────────────────────────────
        print("Updating balance snapshots...")
        db.add(BalanceSnapshot(account_id=treasury.id, balance=treasury.balance))

        await db.commit()
        print("✅ Seed complete — system user + treasury account ready.")


if __name__ == "__main__":
    asyncio.run(seed())

