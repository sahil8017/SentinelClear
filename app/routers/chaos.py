import asyncio
import logging
from urllib.parse import urlparse

import docker
import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.config import settings
from app.dependencies import require_admin

logger = logging.getLogger("chaos")

router = APIRouter(tags=["Chaos"])

try:
    # Uses local docker socket mounted into the container at /var/run/docker.sock
    docker_client = docker.from_env()
except Exception as e:
    logger.warning(f"Could not connect to Docker socket: {e}")
    docker_client = None


async def get_container(name: str):
    if not docker_client:
        raise HTTPException(status_code=500, detail="Docker client unavailable")
    try:
        return await asyncio.to_thread(docker_client.containers.get, name)
    except docker.errors.NotFound:
        raise HTTPException(status_code=404, detail=f"Container {name} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/chaos/kill-db", dependencies=[Depends(require_admin)])
async def kill_db():
    """Pause postgres-db container to simulate DB crash mid-flight"""
    container = await get_container("postgres-db")
    await asyncio.to_thread(container.pause)
    return {"status": "paused", "container": "postgres-db"}


@router.post("/admin/chaos/restore-db", dependencies=[Depends(require_admin)])
async def restore_db():
    """Unpause postgres-db container to recover"""
    container = await get_container("postgres-db")
    await asyncio.to_thread(container.unpause)
    return {"status": "running", "container": "postgres-db"}


@router.post("/admin/chaos/kill-worker", dependencies=[Depends(require_admin)])
async def kill_worker():
    """Pause async-worker container to simulate worker crash"""
    container = await get_container("async-worker")
    await asyncio.to_thread(container.pause)
    return {"status": "paused", "container": "async-worker"}


@router.post("/admin/chaos/restore-worker", dependencies=[Depends(require_admin)])
async def restore_worker():
    """Unpause async-worker container to resume message consumption"""
    container = await get_container("async-worker")
    await asyncio.to_thread(container.unpause)
    return {"status": "running", "container": "async-worker"}


@router.get("/admin/chaos/status")
async def get_chaos_status():
    """Return the status of the DB, worker, and the raw DLQ message count from RabbitMQ."""
    db_status = "unknown"
    worker_status = "unknown"

    if docker_client:
        try:
            db_status = await asyncio.to_thread(lambda: docker_client.containers.get("postgres-db").status)
        except Exception:
            pass
        try:
            worker_status = await asyncio.to_thread(lambda: docker_client.containers.get("async-worker").status)
        except Exception:
            pass

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
