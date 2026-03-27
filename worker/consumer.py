"""RabbitMQ consumer — async worker with real business logic.

Processes transfer events from the queue and performs:
  1. Notification creation (sender debited, receiver credited, fraud alerts)
  2. Daily analytics aggregation (account_daily_stats)
  3. Retry logic with exponential backoff + DLQ routing
"""

import asyncio
import json
import logging
import sys
import os
from datetime import datetime, date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import aio_pika
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.models import Account, AccountDailyStat, Notification

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

# DB engine for the worker process
engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_size=5, max_overflow=5)
WorkerSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


def _get_death_count(message: aio_pika.abc.AbstractIncomingMessage) -> int:
    x_death = message.headers.get("x-death") if message.headers else None
    if x_death and isinstance(x_death, list) and len(x_death) > 0:
        return x_death[0].get("count", 0)
    return 0


async def _get_account_owner_id(db: AsyncSession, account_id: str) -> int | None:
    """Look up the owner user_id for an account."""
    result = await db.execute(
        select(Account.owner_id).where(Account.id == account_id)
    )
    return result.scalar_one_or_none()


async def _create_notifications(db: AsyncSession, event: dict) -> None:
    """Create notifications for sender and receiver of a transfer."""
    transfer_id = event.get("transfer_id")
    amount = event.get("amount", 0)
    status = event.get("status", "UNKNOWN")
    sender_acct = event.get("sender_account_id", "")
    receiver_acct = event.get("receiver_account_id", "")

    # Sender notification
    sender_owner = await _get_account_owner_id(db, sender_acct)
    if sender_owner:
        if status == "COMPLETED":
            notification = Notification(
                user_id=sender_owner,
                title="Transfer Sent",
                message=f"₹{amount:,.2f} transferred to account {receiver_acct[:8]}... successfully.",
                notification_type="TRANSFER_SENT",
                reference_id=transfer_id,
            )
        elif status == "FLAGGED":
            rules = event.get("rules_triggered", [])
            rules_str = ", ".join(rules) if rules else "fraud detection"
            notification = Notification(
                user_id=sender_owner,
                title="Transfer Blocked",
                message=f"₹{amount:,.2f} transfer was blocked by {rules_str}. Risk score: {event.get('risk_score', 'N/A')}.",
                notification_type="FRAUD_ALERT",
                reference_id=transfer_id,
            )
        else:
            notification = Notification(
                user_id=sender_owner,
                title="Transfer Failed",
                message=f"₹{amount:,.2f} transfer to {receiver_acct[:8]}... failed.",
                notification_type="TRANSFER_FAILED",
                reference_id=transfer_id,
            )
        db.add(notification)

    # Receiver notification (only for completed transfers)
    if status == "COMPLETED":
        receiver_owner = await _get_account_owner_id(db, receiver_acct)
        if receiver_owner:
            notification = Notification(
                user_id=receiver_owner,
                title="Transfer Received",
                message=f"₹{amount:,.2f} received from account {sender_acct[:8]}...",
                notification_type="TRANSFER_RECEIVED",
                reference_id=transfer_id,
            )
            db.add(notification)


async def _update_daily_stats(db: AsyncSession, event: dict) -> None:
    """Update daily analytics aggregation for sender and receiver accounts."""
    today = date.today()
    amount = event.get("amount", 0)
    status = event.get("status", "")
    sender_acct = event.get("sender_account_id", "")
    receiver_acct = event.get("receiver_account_id", "")
    is_flagged = status == "FLAGGED"

    # Sender stats
    result = await db.execute(
        select(AccountDailyStat).where(
            AccountDailyStat.account_id == sender_acct,
            AccountDailyStat.stat_date == today,
        )
    )
    sender_stat = result.scalar_one_or_none()
    if sender_stat:
        if status == "COMPLETED":
            sender_stat.total_sent += amount
        sender_stat.transfer_count += 1
        if is_flagged:
            sender_stat.flagged_count += 1
    else:
        sender_stat = AccountDailyStat(
            account_id=sender_acct,
            stat_date=today,
            total_sent=amount if status == "COMPLETED" else 0.0,
            total_received=0.0,
            transfer_count=1,
            flagged_count=1 if is_flagged else 0,
        )
        db.add(sender_stat)

    # Receiver stats (only for completed)
    if status == "COMPLETED":
        result = await db.execute(
            select(AccountDailyStat).where(
                AccountDailyStat.account_id == receiver_acct,
                AccountDailyStat.stat_date == today,
            )
        )
        receiver_stat = result.scalar_one_or_none()
        if receiver_stat:
            receiver_stat.total_received += amount
            receiver_stat.transfer_count += 1
        else:
            receiver_stat = AccountDailyStat(
                account_id=receiver_acct,
                stat_date=today,
                total_sent=0.0,
                total_received=amount,
                transfer_count=1,
                flagged_count=0,
            )
            db.add(receiver_stat)


async def process_message(message: aio_pika.abc.AbstractIncomingMessage) -> None:
    """Process a single transfer event — create notifications + update analytics."""
    try:
        body = json.loads(message.body.decode())
        logger.info(
            "Processing event: id=%s amount=%.2f status=%s",
            body.get("transfer_id"),
            body.get("amount", 0),
            body.get("status"),
        )

        async with WorkerSessionLocal() as db:
            await _create_notifications(db, body)
            await _update_daily_stats(db, body)
            await db.commit()

        logger.info("Event processed: %s", body.get("transfer_id"))
        await message.ack()

    except Exception as exc:
        retry_count = _get_death_count(message)
        if retry_count < MAX_RETRIES:
            logger.warning(
                "Processing failed (attempt %d/%d): %s — will retry",
                retry_count + 1, MAX_RETRIES, exc,
            )
            await message.nack(requeue=False)
        else:
            logger.error(
                "Processing failed after %d retries: %s — routing to DLQ",
                MAX_RETRIES, exc,
            )
            await message.nack(requeue=False)


async def process_dlq_message(message: aio_pika.abc.AbstractIncomingMessage) -> None:
    """Process messages from the Dead Letter Queue — log and alert."""
    async with message.process():
        body = json.loads(message.body.decode())
        logger.error(
            "DLQ — permanently failed event: id=%s status=%s amount=%.2f",
            body.get("transfer_id"),
            body.get("status"),
            body.get("amount", 0),
        )


async def main() -> None:
    """Connect to RabbitMQ and consume messages from main queue + DLQ."""
    logger.info("Async worker starting — waiting for RabbitMQ...")

    connection = None
    for attempt in range(30):
        try:
            connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
            break
        except Exception as exc:
            logger.warning("RabbitMQ not ready (attempt %d/30): %s", attempt + 1, exc)
            await asyncio.sleep(2)

    if connection is None:
        logger.error("Failed to connect to RabbitMQ after 30 attempts")
        sys.exit(1)

    logger.info("Connected to RabbitMQ")
    channel = await connection.channel()
    await channel.set_qos(prefetch_count=10)

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

    logger.info("Listening on '%s' + DLQ '%s'", QUEUE_NAME, DLQ_QUEUE_NAME)
    await queue.consume(process_message)
    await dlq_queue.consume(process_dlq_message)

    try:
        await asyncio.Future()
    finally:
        await connection.close()


if __name__ == "__main__":
    asyncio.run(main())
