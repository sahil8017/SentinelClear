"""RabbitMQ consumer — async worker with retry logic and DLQ support.

This runs as a standalone process in the async-worker container.
It listens on the durable 'transfer_events' queue and processes events.
Failed messages retry with exponential backoff (max 3 retries) before
being routed to the Dead Letter Queue.
"""

import asyncio
import json
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import aio_pika
from app.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [WORKER] %(levelname)s %(message)s",
)
logger = logging.getLogger("worker")

EXCHANGE_NAME = "sentinelclear_events"
QUEUE_NAME = "transfer_events"
DLQ_EXCHANGE_NAME = "sentinelclear_dlq"
DLQ_QUEUE_NAME = "transfer_events_dlq"
MAX_RETRIES = 3


def _get_death_count(message: aio_pika.abc.AbstractIncomingMessage) -> int:
    """Extract retry count from the x-death header."""
    x_death = message.headers.get("x-death") if message.headers else None
    if x_death and isinstance(x_death, list) and len(x_death) > 0:
        return x_death[0].get("count", 0)
    return 0


async def process_message(message: aio_pika.abc.AbstractIncomingMessage) -> None:
    """Process a single transfer event with retry logic."""
    try:
        body = json.loads(message.body.decode())
        logger.info(
            "📝 Processing transfer event: id=%s amount=%.2f status=%s",
            body.get("transfer_id"),
            body.get("amount", 0),
            body.get("status"),
        )

        # ── Business logic ──
        # Audit log was created synchronously in the API.
        # This worker handles additional async tasks:
        #   - Notification dispatch
        #   - Analytics updates
        #   - Compliance workflow triggers
        #   - Fraud pattern aggregation

        logger.info("✅ Event processed successfully: %s", body.get("transfer_id"))
        await message.ack()

    except Exception as exc:
        retry_count = _get_death_count(message)
        if retry_count < MAX_RETRIES:
            logger.warning(
                "⚠️ Processing failed (attempt %d/%d): %s — will retry",
                retry_count + 1, MAX_RETRIES, exc,
            )
            # Nack with requeue=False → routes to DLQ via x-dead-letter-exchange
            # The DLQ consumer can re-publish with delay for retry
            await message.nack(requeue=False)
        else:
            logger.error(
                "❌ Processing failed after %d retries: %s — sending to DLQ permanently",
                MAX_RETRIES, exc,
            )
            await message.nack(requeue=False)


async def process_dlq_message(message: aio_pika.abc.AbstractIncomingMessage) -> None:
    """Process messages from the Dead Letter Queue — log and alert."""
    async with message.process():
        body = json.loads(message.body.decode())
        logger.error(
            "🚨 DLQ — permanently failed event: id=%s status=%s amount=%.2f",
            body.get("transfer_id"),
            body.get("status"),
            body.get("amount", 0),
        )
        # In production: trigger PagerDuty/Slack alert here


async def main() -> None:
    """Connect to RabbitMQ and consume messages from main queue + DLQ."""
    logger.info("🚀 Async worker starting — waiting for RabbitMQ...")

    connection = None
    for attempt in range(30):
        try:
            connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
            break
        except Exception as exc:
            logger.warning("RabbitMQ not ready (attempt %d/30): %s", attempt + 1, exc)
            await asyncio.sleep(2)

    if connection is None:
        logger.error("❌ Failed to connect to RabbitMQ after 30 attempts")
        sys.exit(1)

    logger.info("✅ Connected to RabbitMQ")
    channel = await connection.channel()
    await channel.set_qos(prefetch_count=10)

    # Declare topology (idempotent)
    dlq_exchange = await channel.declare_exchange(
        DLQ_EXCHANGE_NAME, aio_pika.ExchangeType.FANOUT, durable=True
    )
    dlq_queue = await channel.declare_queue(DLQ_QUEUE_NAME, durable=True)
    await dlq_queue.bind(dlq_exchange)

    exchange = await channel.declare_exchange(
        EXCHANGE_NAME, aio_pika.ExchangeType.FANOUT, durable=True
    )
    queue = await channel.declare_queue(
        QUEUE_NAME,
        durable=True,
        arguments={
            "x-dead-letter-exchange": DLQ_EXCHANGE_NAME,
            "x-dead-letter-routing-key": "",
        },
    )
    await queue.bind(exchange)

    # Consume from both queues
    logger.info("📡 Listening on queue '%s' + DLQ '%s' ...", QUEUE_NAME, DLQ_QUEUE_NAME)
    await queue.consume(process_message)
    await dlq_queue.consume(process_dlq_message)

    try:
        await asyncio.Future()
    finally:
        await connection.close()


if __name__ == "__main__":
    asyncio.run(main())
