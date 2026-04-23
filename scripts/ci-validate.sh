#!/usr/bin/env bash
set -euo pipefail

echo "==> Starting SentinelClear stack"
docker compose up -d --build

cleanup() {
  echo "==> Cleaning up containers and volumes"
  docker compose down -v
}
trap cleanup EXIT

echo "==> Waiting for API health"
max_attempts=60
for i in $(seq 1 "$max_attempts"); do
  api_health="$(curl -sS http://localhost:8000/health || true)"
  if [ -n "$api_health" ] && echo "$api_health" | grep -q '"status":"healthy"'; then
    echo "API is healthy"
    break
  fi
  if [ "$i" -eq "$max_attempts" ]; then
    echo "API health failed after $max_attempts attempts"
    docker compose ps
    docker compose logs api-gateway grafana postgres-db redis rabbitmq neo4j
    exit 1
  fi
  sleep 5
done

echo "==> Checking Grafana health endpoint"
curl -fSs http://localhost:3000/api/health > /dev/null
echo "Grafana health endpoint OK"

echo "==> Running tests inside api-gateway"
docker compose exec -T api-gateway python tests/test_everything.py

echo "==> Validation completed successfully"
