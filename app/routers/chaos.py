import asyncio
import logging
from urllib.parse import urlparse

import httpx
import time
import uuid
import random
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.config import settings
from app.dependencies import require_admin
from app.database import AsyncSessionLocal
from app.models import Account
from app.services.ledger import create_double_entry

logger = logging.getLogger("chaos")

router = APIRouter(tags=["Chaos"])


async def perform_container_action(name: str, action: str):
    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(f"http://chaos-admin:8001/containers/{name}/{action}")
            if res.status_code not in (204, 304, 200):
                raise HTTPException(status_code=res.status_code, detail=res.text)
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"Chaos control unavailable: {e}")

async def get_container_status(name: str) -> str:
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(f"http://chaos-admin:8001/containers/{name}/json")
            if res.status_code == 200:
                return res.json().get("State", {}).get("Status", "unknown")
            return "unknown"
        except Exception:
            return "unknown"


@router.post("/admin/chaos/kill-db", dependencies=[Depends(require_admin)])
async def kill_db():
    """Pause postgres-db container to simulate DB crash mid-flight"""
    await perform_container_action("postgres-db", "pause")
    return {"status": "paused", "container": "postgres-db"}


@router.post("/admin/chaos/restore-db", dependencies=[Depends(require_admin)])
async def restore_db():
    """Unpause postgres-db container to recover"""
    await perform_container_action("postgres-db", "unpause")
    return {"status": "running", "container": "postgres-db"}


@router.post("/admin/chaos/kill-worker", dependencies=[Depends(require_admin)])
async def kill_worker():
    """Pause async-worker container to simulate worker crash"""
    await perform_container_action("async-worker", "pause")
    return {"status": "paused", "container": "async-worker"}


@router.post("/admin/chaos/restore-worker", dependencies=[Depends(require_admin)])
async def restore_worker():
    """Unpause async-worker container to resume message consumption"""
    await perform_container_action("async-worker", "unpause")
    return {"status": "running", "container": "async-worker"}


@router.post("/admin/chaos/stress-test", dependencies=[Depends(require_admin)])
async def stress_test():
    """Fire 50 concurrent transactions directly against the double-entry accounting engine to verify lock mechanics."""
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Account).limit(2))
        accounts = res.scalars().all()
        if len(accounts) < 2:
            return {"error": "Need at least 2 accounts initialized to run tests."}
        acct1, acct2 = accounts[0], accounts[1]

    async def _concurrent_worker(attempt: int):
        async with AsyncSessionLocal() as session:
            try:
                # Always sort IDs for uniform lock acquisition to avoid classical dining philosophers deadlock natively
                id1, id2 = (acct1.id, acct2.id) if acct1.id < acct2.id else (acct2.id, acct1.id)
                # FOR UPDATE row-level lock
                r1 = await session.execute(select(Account).where(Account.id == id1).with_for_update())
                r2 = await session.execute(select(Account).where(Account.id == id2).with_for_update())
                
                s1, s2 = r1.scalar_one(), r2.scalar_one()
                # To simulate massive load & force collisions, we use a random tiny float
                amount = round(random.uniform(0.01, 0.05), 2)
                
                if s1.balance < amount:
                    return {"status": "failed", "reason": "insufficient_balance"}
                
                s1.balance -= amount
                s2.balance += amount
                
                transfer_id = str(uuid.uuid4())
                await create_double_entry(
                   session,
                   transfer_id,
                   s1.id, s2.id, amount,
                   s1.balance, s2.balance
                )
                await session.commit()
                return {"status": "succeeded", "reason": None}
            except Exception as e:
                await session.rollback()
                return {"status": "deadlock", "reason": str(e)}

    start_time = time.time()
    
    # 50 Simultaneous Tasks Launched without any intermediate yields
    tasks = [_concurrent_worker(i) for i in range(50)]
    results = await asyncio.gather(*tasks)
    
    latency = time.time() - start_time
    succeeded = sum(1 for r in results if r["status"] == "succeeded")
    failed = sum(1 for r in results if r["status"] == "failed")
    deadlocks = sum(1 for r in results if r["status"] == "deadlock")
    
    return {
        "metrics": {
            "attempted": 50,
            "succeeded": succeeded,
            "failed_validation": failed, 
            "deadlocks": deadlocks,
            "latency_ms": round(latency * 1000, 2)
        }
    }


@router.get("/admin/chaos/status")
async def get_chaos_status():
    """Return the status of the DB, worker, and the raw DLQ message count from RabbitMQ."""
    db_status = await get_container_status("postgres-db")
    worker_status = await get_container_status("async-worker")

    # Extract RabbitMQ credentials to query management API
    parsed_url = urlparse(settings.RABBITMQ_URL)
    username = parsed_url.username or "guest"
    password = parsed_url.password or "guest"
    mgmt_host = parsed_url.hostname or "rabbitmq"
    
    # Port 15672 is standard for RMQ management
    mgmt_url = f"http://{mgmt_host}:15672/api/queues/%2F/transfer_events_dlq"

    dlq_count = 0
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(mgmt_url, auth=(username, password))
            if resp.status_code == 200:
                data = resp.json()
                dlq_count = data.get("messages", 0)
            else:
                logger.warning("DLQ status request returned %s", resp.status_code)
    except Exception as e:
        logger.error(f"Failed to fetch DLQ count: {e}")

    return {
        "db_status": db_status,
        "worker_status": worker_status,
        "dlq_count": dlq_count
    }
