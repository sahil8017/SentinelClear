import logging
from typing import List

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from app.dependencies import require_admin

logger = logging.getLogger("websocket")

router = APIRouter(tags=["WebSocket"])


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
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


@router.websocket("/ws/fraud-alerts")
async def websocket_fraud_alerts(websocket: WebSocket):
    """Real-time fraud event stream."""
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection open and wait for incoming messages if any
            # In our case, backend just pushes, so we can wait on receive
            _ = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


@router.post("/internal/broadcast-fraud", dependencies=[Depends(require_admin)])
async def broadcast_fraud(event: dict):
    """Internal endpoint to broadcast fraud events to all connected clients."""
    await manager.broadcast(event)
    return {"status": "broadcasted"}
