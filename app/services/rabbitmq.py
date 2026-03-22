"""RabbitMQ publisher — fires transfer events with DLQ support."""

import json
import logging

import aio_pika

from app.config import settings

logger = logging.getLogger("sentinelclear.rabbitmq")

EXCHANGE_NAME = "sentinelclear_events"
QUEUE_NAME = "transfer_events"
DLQ_EXCHANGE_NAME = "sentinelclear_dlq"
DLQ_QUEUE_NAME = "transfer_events_dlq"

_connection: aio_pika.abc.AbstractRobustConnection | None = None
_channel: aio_pika.abc.AbstractChannel | None = None


async def connect() -> None:
    """Open a persistent connection and channel to RabbitMQ with DLQ topology."""
    global _connection, _channel
    try:
        _connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
        _channel = await _connection.channel()

        # Declare DLQ exchange + queue first
        dlq_exchange = await _channel.declare_exchange(
            DLQ_EXCHANGE_NAME, aio_pika.ExchangeType.FANOUT, durable=True
        )
        dlq_queue = await _channel.declare_queue(DLQ_QUEUE_NAME, durable=True)
        await dlq_queue.bind(dlq_exchange)

        # Declare main exchange + queue with DLQ routing
        exchange = await _channel.declare_exchange(
            EXCHANGE_NAME, aio_pika.ExchangeType.FANOUT, durable=True
        )
        queue = await _channel.declare_queue(
            QUEUE_NAME,
            durable=True,
            arguments={
                "x-dead-letter-exchange": DLQ_EXCHANGE_NAME,
                "x-dead-letter-routing-key": "",
            },
        )
        await queue.bind(exchange)

        logger.info("Connected to RabbitMQ — main queue + DLQ topology ready")
    except Exception as exc:
        logger.warning("RabbitMQ connection failed (will retry on next publish): %s", exc)


async def disconnect() -> None:
    """Gracefully close the RabbitMQ connection."""
    global _connection, _channel
    if _connection and not _connection.is_closed:
        await _connection.close()
    _connection = None
    _channel = None


async def publish_transfer_event(event: dict) -> None:
    """Publish a transfer event to the durable fanout exchange.

    If the connection is unavailable the error is logged but does NOT
    block the HTTP response — the event queue will catch up later.
    """
    global _channel
    if _channel is None or _channel.is_closed:
        await connect()

    if _channel is None:
        logger.error("Unable to publish event — RabbitMQ unavailable")
        return

    try:
        exchange = await _channel.get_exchange(EXCHANGE_NAME)
        message = aio_pika.Message(
            body=json.dumps(event).encode(),
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
        )
        await exchange.publish(message, routing_key="")
        logger.info("Published transfer event: %s", event.get("transfer_id"))
    except Exception as exc:
        logger.error("Failed to publish event: %s", exc)
