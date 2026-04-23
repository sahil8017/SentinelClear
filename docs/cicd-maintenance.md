# SentinelClear CI/CD Maintenance Guide

## What changed
- Added Grafana provisioning directories for `alerting`, `notifiers`, and `dashboards`.
- Hardened API health checks to return `503` when dependencies are degraded.
- Added optional Grafana dependency in health checks via `REQUIRE_GRAFANA_FOR_HEALTH`.
- Upgraded workflow checkout action to `actions/checkout@v5`.
- Enabled `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` in CI jobs.

## Why this matters
- Missing Grafana provisioning directories can break service startup in CI.
- Health checks that always return `200` hide dependency failures.
- Node.js 20 deprecation can break workflows if not upgraded.

## Daily operations
1. Run local CI validation:
   ```bash
   bash scripts/ci-validate.sh
   ```
   On Windows PowerShell:
   ```powershell
   .\scripts\ci-validate.ps1
   ```
2. If validation fails, inspect:
   ```bash
   docker compose ps
   docker compose logs api-gateway grafana postgres-db redis rabbitmq neo4j
   ```

## Grafana provisioning ownership
- Keep files under `monitoring/grafana/provisioning/`.
- Never delete `alerting/` or `notifiers/` directories even if unused.
- Dashboard provider files should continue to point to:
  - `/etc/grafana/provisioning/dashboards`

## Health check behavior
- Endpoint: `/health`
- Returns:
  - `200` + `status=healthy` when all required dependencies are up
  - `503` + `status=degraded` when any required dependency is down
- `REQUIRE_GRAFANA_FOR_HEALTH=false` (default) keeps observability non-blocking.

## CI compatibility notes
- Current workflows use Node 24 runtime compatibility for JavaScript actions.
- Periodically check GitHub Actions changelogs for runtime deprecations.
