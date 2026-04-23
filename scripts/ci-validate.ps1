$ErrorActionPreference = "Stop"

Write-Output "==> Starting SentinelClear stack"
docker compose up -d --build

try {
    Write-Output "==> Waiting for API health"
    $maxAttempts = 60
    $apiHealthy = $false

    for ($i = 1; $i -le $maxAttempts; $i++) {
        try {
            $health = Invoke-RestMethod -Uri "http://localhost:8000/health" -TimeoutSec 5
            if ($health.status -eq "healthy") {
                Write-Output "API is healthy"
                $apiHealthy = $true
                break
            }
        } catch {
            # Service may still be starting up.
        }

        Write-Output "Attempt $i/$maxAttempts - API not healthy yet"
        Start-Sleep -Seconds 5
    }

    if (-not $apiHealthy) {
        Write-Output "API health failed after $maxAttempts attempts"
        docker compose ps
        docker compose logs api-gateway grafana postgres-db redis rabbitmq neo4j
        exit 1
    }

    Write-Output "==> Checking Grafana health endpoint"
    $grafana = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -TimeoutSec 5
    if (-not $grafana) {
        throw "Grafana health check returned an empty response."
    }
    Write-Output "Grafana health endpoint OK"

    Write-Output "==> Running tests inside api-gateway"
    docker compose exec -T api-gateway python tests/test_everything.py

    Write-Output "==> Validation completed successfully"
}
finally {
    Write-Output "==> Cleaning up containers and volumes"
    docker compose down -v
}
