import logging
from typing import List
from urllib.parse import parse_qs

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt

from app.config import settings
from app.dependencies import require_admin

logger = logging.getLogger("websocket")

router = APIRouter(tags=["WebSocket"])


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        # websocket is already accepted by the endpoint before this is called
        self.active_connections.append(websocket)
        logger.info(f"Client connected. Active clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"Client disconnected. Active clients: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        connections = list(self.active_connections)
        for connection in connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to client: {e}")


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
