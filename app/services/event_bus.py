"""Kafka event bus - AIOKafka producer for streaming transfer events."""

import json
import logging
import os
from typing import Optional

logger = logging.getLogger("sentinelclear.eventbus")

_producer = None


async def connect_kafka() -> None:
    """Initialize AIOKafka producer on startup."""
    global _producer
    bootstrap = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
    try:
        from aiokafka import AIOKafkaProducer
        _producer = AIOKafkaProducer(
            bootstrap_servers=bootstrap,
            value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
        )
        await _producer.start()
        logger.info("Kafka producer connected to %s", bootstrap)
    except Exception as exc:
        logger.warning("Kafka connection failed (event streaming disabled): %s", exc)
        _producer = None


async def disconnect_kafka() -> None:
    """Shutdown the Kafka producer gracefully."""
    global _producer
    if _producer:
        await _producer.stop()
        _producer = None


async def publish_event(topic: str, event: dict) -> None:
    """Publish an event to a Kafka topic. Non-blocking, best-effort."""
    if _producer is None:
        return
    try:
        await _producer.send_and_wait(topic, event)
    except Exception as exc:
        logger.warning("Failed to publish event to %s: %s", topic, exc)
