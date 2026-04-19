"""Background webhook dispatcher for BaaS platform."""

import json
import logging
import hmac
import hashlib
import asyncio
import httpx
from datetime import datetime, timezone
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models import WebhookEndpoint

logger = logging.getLogger(__name__)

async def dispatch_webhook(user_id: int, payload: dict):
    """
    Looks up webhook target URLs for the given user and dispatches
    the payload asynchronously via HTTP POST.
    Best-effort: failures here must never crash the calling transfer/loan flow.
    """
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(WebhookEndpoint).where(WebhookEndpoint.user_id == user_id)
            )
            endpoints = result.scalars().all()
    except Exception as e:
        logger.warning(f"Webhook dispatch skipped — DB lookup failed: {e}")
        return
        
    if not endpoints:
        return
        
    for endpoint in endpoints:
        # Fire and forget sending logic in background task
        asyncio.create_task(_send_to_endpoint(endpoint, payload))


async def _send_to_endpoint(endpoint: WebhookEndpoint, payload: dict):
    """Internal function to sign and send the webhook payload."""
    data = json.dumps(payload)
    
    # Generate HMAC SHA-256 signature
    signature = hmac.new(
        key=endpoint.secret.encode("utf-8"),
        msg=data.encode("utf-8"),
        digestmod=hashlib.sha256
    ).hexdigest()
    
    headers = {
        "Content-Type": "application/json",
        "X-SentinelClear-Signature": signature,
        "X-SentinelClear-Event": payload.get("event", "transfer.event"),
        "X-SentinelClear-Timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                endpoint.target_url,
                content=data,
                headers=headers
            )
            response.raise_for_status()
            logger.info(f"Webhook dispatched successfully to {endpoint.target_url}")
    except Exception as e:
        logger.error(f"Failed to dispatch webhook to {endpoint.target_url}: {e}")
