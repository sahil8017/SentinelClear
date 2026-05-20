#!/bin/bash
set -e

# Hugging Face / cloud: service account JSON as a secret (not a file in the image).
if [ -n "${FIREBASE_SERVICE_ACCOUNT_JSON:-}" ] && [ ! -f "${GOOGLE_APPLICATION_CREDENTIALS:-service-account.json}" ]; then
  creds_path="${GOOGLE_APPLICATION_CREDENTIALS:-/app/service-account.json}"
  printf '%s' "$FIREBASE_SERVICE_ACCOUNT_JSON" > "$creds_path"
  export GOOGLE_APPLICATION_CREDENTIALS="$creds_path"
  echo "✅ Firebase Admin credentials written from FIREBASE_SERVICE_ACCOUNT_JSON"
fi

if [ -f frontend/scripts/write-firebase-config.sh ]; then
  FIREBASE_DIST=frontend/dist sh frontend/scripts/write-firebase-config.sh
fi

echo "⏳ Running database migrations..."
alembic upgrade head

echo "⏳ Starting RabbitMQ consumer worker..."
python -m worker.consumer &

echo "🚀 Starting FastAPI gateway on port 7860..."
exec uvicorn app.main:app --host 0.0.0.0 --port 7860
