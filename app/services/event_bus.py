"""RabbitMQ event bus — publishes typed events to the `transaction.events` topic exchange.

Replaces the previous Kafka/aiokafka implementation.  The public API surface is
intentionally identical so that callers in main.py do not need to change:

  connect_kafka()    — no-op stub (Kafka removed)
  disconnect_kafka() — no-op stub (Kafka removed)
  publish_event(event_type, payload) — publishes to RabbitMQ topic exchange
"""

import json
import logging
import os
from typing import Optional

import aio_pika
from aio_pika.abc import AbstractRobustConnection, AbstractChannel

logger = logging.getLogger("sentinelclear.eventbus")

EXCHANGE_NAME = "transaction.events"
EXCHANGE_TYPE = aio_pika.ExchangeType.TOPIC

_connection: Optional[AbstractRobustConnection] = None
_channel: Optional[AbstractChannel] = None


# ── Kafka stubs (kept so main.py startup/shutdown hooks need no changes) ──────

async def connect_kafka() -> None:
    """No-op stub — Kafka has been removed. RabbitMQ is used instead."""
    logger.info("connect_kafka() called — Kafka removed; event bus uses RabbitMQ (no-op).")


async def disconnect_kafka() -> None:
    """No-op stub — Kafka has been removed. RabbitMQ connection is managed separately."""
    logger.info("disconnect_kafka() called — no-op (Kafka removed).")


# ── Internal RabbitMQ helpers ─────────────────────────────────────────────────

async def _ensure_connected() -> bool:
    """Lazily open (or re-open) the RabbitMQ connection and declare the exchange.

    Returns True if the channel is ready, False otherwise.
    """
    global _connection, _channel
    rabbitmq_url = os.getenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")

    try:
        if _connection is None or _connection.is_closed:
            _connection = await aio_pika.connect_robust(rabbitmq_url)
            _channel = None  # force channel re-creation

        if _channel is None or _channel.is_closed:
            _channel = await _connection.channel()
            await _channel.declare_exchange(
                EXCHANGE_NAME,
                EXCHANGE_TYPE,
                durable=True,
            )
            logger.info("Event bus: connected to RabbitMQ exchange '%s'", EXCHANGE_NAME)

        return True
    except Exception as exc:
        logger.warning(
            "Event bus: RabbitMQ unavailable — event will be dropped: %s", exc
        )
        _connection = None
        _channel = None
        return False


# ── Public API ────────────────────────────────────────────────────────────────

async def publish_event(event_type: str, payload: dict) -> None:
    """Publish an event to the ``transaction.events`` topic exchange.

    Args:
        event_type: Routing key (e.g. ``"transfer.completed"``).
        payload:    Arbitrary JSON-serialisable dict.

    The call is best-effort and non-blocking — if RabbitMQ is unavailable the
    error is logged and execution continues without raising.
    """
    if not await _ensure_connected():
        return

    try:
        exchange = await _channel.get_exchange(EXCHANGE_NAME)
        message = aio_pika.Message(
            body=json.dumps(payload, default=str).encode("utf-8"),
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
        )
        await exchange.publish(message, routing_key=event_type)
        logger.info("Event bus: published '%s' event", event_type)
    except Exception as exc:
        logger.warning("Event bus: failed to publish '%s': %s", event_type, exc)
