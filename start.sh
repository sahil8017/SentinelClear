#!/bin/bash
set -e

echo "⏳ Running database migrations..."
alembic upgrade head

echo "⏳ Starting RabbitMQ consumer worker..."
python -m worker.consumer &

echo "🚀 Starting FastAPI gateway on port 7860..."
exec uvicorn app.main:app --host 0.0.0.0 --port 7860
