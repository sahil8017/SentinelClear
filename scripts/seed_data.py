import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import uuid

# Ensure imports work when run from project root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from passlib.context import CryptContext
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models import (
    Account, AuditLog, BalanceSnapshot, CreditProfile, FraudRuleConfig,
    LedgerEntry, Loan, Notification, SystemConfig, Transfer, User
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def seed():
    print("🌱 Starting Database Seed...")
    async with AsyncSessionLocal() as db:
        
        # 1. System & Admin Users
        print("Creating system users...")
        system_res = await db.execute(select(User).where(User.username == "system"))
        system_user = system_res.scalar_one_or_none()
        if not system_user:
            system_user = User(
                username="system",
                email="system@sentinelclear.local",
                hashed_password=pwd_context.hash("systempass"),
                role="ADMIN",
                profile_complete=True
            )
            db.add(system_user)
            await db.flush()

        admin_res = await db.execute(select(User).where(User.username == "admin"))
        admin_user = admin_res.scalar_one_or_none()
        if not admin_user:
            admin_user = User(
                username="admin",
                email="admin@sentinelclear.local",
                hashed_password=pwd_context.hash("admin123"),
                transaction_pin_hash=pwd_context.hash("1234"),
                role="ADMIN",
                profile_complete=True,
                kyc_status="VERIFIED"
            )
            db.add(admin_user)
            await db.flush()

        # Treasury Account
        TREASURY_ACCOUNT_ID = "00000000-0000-0000-0000-000000000000"
        treasury_res = await db.execute(select(Account).where(Account.id == TREASURY_ACCOUNT_ID))
        treasury = treasury_res.scalar_one_or_none()
        if not treasury:
            treasury = Account(
                id=TREASURY_ACCOUNT_ID,
                owner_id=system_user.id,
                account_type="treasury",
                balance=Decimal("1000000000.00")  # Large reserve
            )
            db.add(treasury)

        # Admin Account
        admin_acct_res = await db.execute(select(Account).where(Account.owner_id == admin_user.id))
        admin_acct = admin_acct_res.scalar_one_or_none()
        if not admin_acct:
            admin_acct = Account(
                owner_id=admin_user.id,
                account_type="savings",
                balance=Decimal("150000.00")
            )
            db.add(admin_acct)
            await db.flush()

        # 2. Demo Users (Alice, Bob, Charlie)
        print("Creating demo users & accounts...")
        users_data = [
            {"username": "alice", "email": "alice@example.com", "balance": "55000.00", "score": 750, "kyc": "VERIFIED"},
            {"username": "bob", "email": "bob@example.com", "balance": "12000.00", "score": 620, "kyc": "VERIFIED"},
            {"username": "charlie", "email": "charlie@example.com", "balance": "85000.00", "score": 810, "kyc": "VERIFIED"},
        ]
        
        user_map = {}
        acct_map = {}
        
        for u in users_data:
            res = await db.execute(select(User).where(User.username == u["username"]))
            user = res.scalar_one_or_none()
            if not user:
                user = User(
                    username=u["username"],
                    email=u["email"],
                    hashed_password=pwd_context.hash("demo123"),
                    transaction_pin_hash=pwd_context.hash("1234"),
                    role="USER",
                    profile_complete=True,
                    kyc_status=u["kyc"]
                )
                db.add(user)
                await db.flush()
                
                # Credit Profile
                profile = CreditProfile(
                    user_id=user.id,
                    monthly_income=Decimal("80000.00"),
                    existing_liabilities=Decimal("5000.00"),
                    total_assets=Decimal("200000.00"),
                    credit_score=u["score"],
                    ml_eligibility_score=Decimal("0.85")
                )
                db.add(profile)
                
                # Account
                acct = Account(
                    owner_id=user.id,
                    account_type="savings",
                    balance=Decimal(u["balance"])
                )
                db.add(acct)
                await db.flush()
                
                user_map[u["username"]] = user
                acct_map[u["username"]] = acct
            else:
                user_map[u["username"]] = user
                # get acct
                acct_res = await db.execute(select(Account).where(Account.owner_id == user.id))
                acct_map[u["username"]] = acct_res.scalars().first()

        # 3. Create Transfers
        print("Generating mock transfers...")
        now = datetime.now(timezone.utc)
        
        # We will generate a few transfers from treasury to admin, alice to bob, etc.
        transfers_data = [
            {"from": TREASURY_ACCOUNT_ID, "to": admin_acct.id, "amount": "50000.00", "status": "COMPLETED", "risk": 0.0, "time_offset": 30},
            {"from": acct_map["alice"].id, "to": acct_map["bob"].id, "amount": "2500.00", "status": "COMPLETED", "risk": 0.1, "time_offset": 25},
            {"from": acct_map["charlie"].id, "to": acct_map["alice"].id, "amount": "12000.00", "status": "COMPLETED", "risk": 0.05, "time_offset": 20},
            {"from": acct_map["bob"].id, "to": admin_acct.id, "amount": "450.00", "status": "COMPLETED", "risk": 0.15, "time_offset": 15},
            # Flagged transfer
            {"from": acct_map["charlie"].id, "to": acct_map["bob"].id, "amount": "95000.00", "status": "FLAGGED", "risk": 0.85, "time_offset": 10, "rules": '["VELOCITY_SPIKE", "LARGE_AMOUNT_ANOMALY"]'},
            # Failed transfer
            {"from": acct_map["alice"].id, "to": acct_map["charlie"].id, "amount": "999999.00", "status": "FAILED", "risk": 0.2, "time_offset": 5},
        ]
        
        for idx, t in enumerate(transfers_data):
            tid = str(uuid.uuid4())
            created_at = now - timedelta(days=t["time_offset"])
            
            tx = Transfer(
                id=tid,
                sender_account_id=t["from"],
                receiver_account_id=t["to"],
                amount=Decimal(t["amount"]),
                status=t["status"],
                risk_score=t["risk"],
                ml_risk_score=t["risk"] - 0.05 if t["risk"] >= 0.05 else 0.0,
                fraud_rules_triggered=t.get("rules"),
                created_at=created_at.replace(tzinfo=None)
            )
            db.add(tx)
            
            if t["status"] == "COMPLETED":
                # Double entry
                db.add(LedgerEntry(transfer_id=tid, account_id=t["from"], entry_type="DEBIT", amount=Decimal(t["amount"]), balance_after=Decimal("0.0"), created_at=created_at.replace(tzinfo=None)))
                db.add(LedgerEntry(transfer_id=tid, account_id=t["to"], entry_type="CREDIT", amount=Decimal(t["amount"]), balance_after=Decimal("0.0"), created_at=created_at.replace(tzinfo=None)))
            
            # Audit log
            db.add(AuditLog(
                transfer_id=tid, action=f"TRANSFER_{t['status']}", previous_hash="mock_prev", current_hash="mock_curr",
                sender_account_id=t["from"], receiver_account_id=t["to"], created_at=created_at.replace(tzinfo=None)
            ))

        # 4. Create Loans
        print("Generating mock loans...")
        loans_data = [
            {"user": user_map["bob"], "acct": acct_map["bob"], "amount": "50000.00", "status": "PENDING"},
            {"user": user_map["alice"], "acct": acct_map["alice"], "amount": "200000.00", "status": "ACTIVE"},
        ]
        for ld in loans_data:
            ln = Loan(
                user_id=ld["user"].id,
                account_id=ld["acct"].id,
                principal_amount=Decimal(ld["amount"]),
                outstanding_balance=Decimal(ld["amount"]),
                interest_rate=Decimal("10.5"),
                status=ld["status"]
            )
            db.add(ln)

        # 5. Snapshots
        print("Updating balance snapshots...")
        for acct in [treasury, admin_acct] + list(acct_map.values()):
            db.add(BalanceSnapshot(account_id=acct.id, balance=acct.balance))

        await db.commit()
        print("✅ Seed Data Inserted Successfully!")

if __name__ == "__main__":
    asyncio.run(seed())
