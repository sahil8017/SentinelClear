import logging
import json
import asyncio
from typing import List
from urllib.parse import parse_qs

import redis.asyncio as redis
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt

from app.config import settings
from app.dependencies import require_admin

logger = logging.getLogger("websocket")

router = APIRouter(tags=["WebSocket"])


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.redis_client = None
        self.pubsub = None
        self.listener_task = None

    async def connect(self, websocket: WebSocket):
        # websocket is already accepted by the endpoint before this is called
        self.active_connections.append(websocket)
        logger.info(f"Client connected. Active clients: {len(self.active_connections)}")
        
        # Spawn pub/sub listener task if it is not already running
        if self.listener_task is None or self.listener_task.done():
            self.listener_task = asyncio.create_task(self._redis_pubsub_listener())

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"Client disconnected. Active clients: {len(self.active_connections)}")

    async def _local_broadcast(self, message: dict):
        """Send message locally to all connections on this instance."""
        connections = list(self.active_connections)
        for connection in connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting locally to client: {e}")

    async def broadcast(self, message: dict):
        """Publish the message to Redis Pub/Sub to broadcast across all replicas."""
        try:
            if self.redis_client is None:
                self.redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
            
            # Helper to convert non-JSON serializable values like Decimal or datetime
            def json_serialize_clean(val):
                from decimal import Decimal
                from datetime import datetime, date
                if isinstance(val, (Decimal, float)):
                    return float(val)
                if isinstance(val, (datetime, date)):
                    return val.isoformat()
                return str(val)

            payload = json.dumps(message, default=json_serialize_clean)
            await self.redis_client.publish("sentinelclear:fraud_alerts", payload)
            logger.info("Published fraud alert to Redis Pub/Sub channel 'sentinelclear:fraud_alerts'")
        except Exception as e:
            logger.error(f"Failed to publish to Redis Pub/Sub: {e}. Falling back to local broadcast.")
            await self._local_broadcast(message)

    async def _redis_pubsub_listener(self):
        """Background listener subscribing to Redis Pub/Sub and broadcasting received messages."""
        logger.info("Starting Redis Pub/Sub WebSocket listener task...")
        retry_delay = 1
        while True:
            try:
                if self.redis_client is None:
                    self.redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
                
                self.pubsub = self.redis_client.pubsub()
                await self.pubsub.subscribe("sentinelclear:fraud_alerts")
                logger.info("Successfully subscribed to Redis channel 'sentinelclear:fraud_alerts'")
                
                retry_delay = 1 # Reset retry delay on successful subscription
                
                while True:
                    try:
                        msg = await self.pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                        if msg and msg.get("type") == "message":
                            data = json.loads(msg["data"])
                            await self._local_broadcast(data)
                    except asyncio.CancelledError:
                        raise
                    except Exception as inner_exc:
                        logger.error(f"Error inside Redis Pub/Sub read loop: {inner_exc}")
                        await asyncio.sleep(1)
                        break # Break to trigger reconnect
            except asyncio.CancelledError:
                logger.info("Redis Pub/Sub listener task cancelled")
                break
            except Exception as e:
                logger.error(f"Redis Pub/Sub connection error: {e}. Reconnecting in {retry_delay}s...")
                await asyncio.sleep(retry_delay)
                retry_delay = min(retry_delay * 2, 30)


manager = ConnectionManager()


def _verify_ws_token(token: str) -> dict:
    """Verify a JWT token for WebSocket authentication.

    Returns the decoded payload if valid, raises ValueError otherwise.
    """
    try:
        import os
        with open(os.path.join("keys", "jwt_public.pem"), "r") as f:
            public_key = f.read()
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
        )
        user_id = payload.get("sub")
        if user_id is None:
            raise ValueError("Invalid token payload — missing 'sub'")
        return payload
    except JWTError as exc:
        raise ValueError(f"JWT verification failed: {exc}")


@router.websocket("/ws/fraud-alerts")
async def websocket_fraud_alerts(websocket: WebSocket):
    """Real-time fraud event stream (authenticated via query param token).

    Accept is called first so the browser gets a proper WS close frame
    instead of a raw TCP reset, which eliminates the 'failed' console error.
    """
    # Always accept first so we can send proper close codes
    await websocket.accept()

    # ── Extract token from query string ──
    try:
        query_params = parse_qs(websocket.scope.get("query_string", b"").decode())
        token_list = query_params.get("token", [])

        if not token_list:
            logger.warning("WebSocket: no token provided, closing with 4401")
            await websocket.close(code=4401, reason="Authentication required — pass ?token=<JWT>")
            return

        try:
            payload = _verify_ws_token(token_list[0])
            logger.info(
                "WebSocket authenticated: user_id=%s role=%s",
                payload.get("sub"),
                payload.get("role"),
            )
        except ValueError as exc:
            logger.warning("WebSocket: token verification failed: %s", exc)
            await websocket.close(code=4403, reason=str(exc))
            return

    except Exception as exc:
        logger.error("WebSocket: unexpected error during auth phase: %s", exc)
        await websocket.close(code=4500, reason="Internal server error during authentication")
        return

    # ── Auth passed — register and run the connection loop ──
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive; backend pushes events via manager.broadcast()
            _ = await websocket.receive_text()
    except WebSocketDisconnect:
        logger.info("WebSocket: client disconnected cleanly")
        manager.disconnect(websocket)
    except Exception as exc:
        logger.error("WebSocket: runtime error: %s", exc)
        manager.disconnect(websocket)


@router.post("/internal/broadcast-fraud", dependencies=[Depends(require_admin)])
async def broadcast_fraud(event: dict):
    """Internal endpoint to broadcast fraud events to all connected clients."""
    await manager.broadcast(event)
    return {"status": "broadcasted"}
