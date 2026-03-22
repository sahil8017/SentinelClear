# SentinelClear — Complete Testing Guide

Step-by-step commands to test **every feature** of the project.  
Run all commands in **PowerShell** from the project root (`c:\MAJOR\SentinelClear`).

---

## Step 0: Build & Start Everything

```powershell
# Build all containers from scratch
docker compose build --no-cache

# Start all 7 containers in detached mode
docker compose up -d

# Wait ~20 seconds for services to become healthy, then verify
docker compose ps
```

**Expected:** All 7 containers show `healthy` — `postgres-db`, `rabbitmq`, `redis`, `api-gateway`, `async-worker`, `prometheus`, `grafana`.

```powershell
# Confirm the ML fraud model loaded correctly
docker logs api-gateway 2>&1 | Select-String "fraud|model|fallback"
```

**Expected:** `"ML fraud model loaded"` and `"Fraud detection service ready"`.  
If you see `"rule-based fallback"` — check that `model/fraud_model.pkl` exists and that the volume mount in `docker-compose.yml` is intact.

---

## Step 1: System Health

```powershell
curl http://localhost:8000/health
```

**Expected:**
```json
{"status":"healthy","database":"healthy","rabbitmq":"healthy","redis":"healthy"}
```

---

## Step 2: API Documentation

Open in browser:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
- **OpenAPI JSON:** http://localhost:8000/openapi.json

**Expected:** All endpoints listed with correct request/response schemas.

---

## Step 3: User Registration

```powershell
# Register User 1 (Alice)
curl -X POST http://localhost:8000/auth/register `
  -H "Content-Type: application/json" `
  -d '{"username":"alice","email":"alice@test.com","password":"pass123"}'
```

**Expected:** `201` with `{id, username, email, created_at}`.

```powershell
# Register User 2 (Bob)
curl -X POST http://localhost:8000/auth/register `
  -H "Content-Type: application/json" `
  -d '{"username":"bob","email":"bob@test.com","password":"pass456"}'
```

```powershell
# Duplicate registration — should fail
curl -X POST http://localhost:8000/auth/register `
  -H "Content-Type: application/json" `
  -d '{"username":"alice","email":"alice@test.com","password":"pass123"}'
```

**Expected:** `400` — `"Username or email already registered"`.

---

## Step 4: Login & JWT Tokens

```powershell
# Login as Alice
curl -X POST http://localhost:8000/auth/login `
  -H "Content-Type: application/json" `
  -d '{"username":"alice","password":"pass123"}'
```

**Expected:** `200` with `{"access_token":"eyJ...","token_type":"bearer"}`.

```powershell
# Save tokens as PowerShell variables
$ALICE_TOKEN = "PASTE_ALICE_TOKEN_HERE"
$BOB_TOKEN   = "PASTE_BOB_TOKEN_HERE"
```

```powershell
# Wrong password — should fail
curl -X POST http://localhost:8000/auth/login `
  -H "Content-Type: application/json" `
  -d '{"username":"alice","password":"wrongpass"}'
```

**Expected:** `401` — `"Invalid username or password"`.

---

## Step 5: Protected Route Without Token

```powershell
curl http://localhost:8000/accounts/test/balance
```

**Expected:** `401` or `403` — proves all account routes are JWT-protected.

---

## Step 6: Account Management

```powershell
# Create Alice's savings account
curl -X POST http://localhost:8000/accounts `
  -H "Authorization: Bearer $ALICE_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"account_type":"savings"}'
```

**Expected:** `201` with `{id (UUID), balance: 0.0, account_type, owner_id}`.

```powershell
# Save Alice's account ID
$ALICE_ACCT = "PASTE_ALICE_ACCOUNT_ID_HERE"
```

```powershell
# Create a second account for Alice (checking) — proves multi-account support
curl -X POST http://localhost:8000/accounts `
  -H "Authorization: Bearer $ALICE_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"account_type":"checking"}'
```

```powershell
# Create Bob's account
curl -X POST http://localhost:8000/accounts `
  -H "Authorization: Bearer $BOB_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"account_type":"savings"}'

$BOB_ACCT = "PASTE_BOB_ACCOUNT_ID_HERE"
```

---

## Step 7: Deposits & Balance

```powershell
# Deposit ₹1,00,000 into Alice's account
curl -X POST http://localhost:8000/accounts/$ALICE_ACCT/deposit `
  -H "Authorization: Bearer $ALICE_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"amount":100000}'
```

**Expected:** Account object with `balance: 100000.0`.

```powershell
# Check balance (reads from Redis cache on second call)
curl http://localhost:8000/accounts/$ALICE_ACCT/balance `
  -H "Authorization: Bearer $ALICE_TOKEN"
```

**Expected:** `{"account_id":"...","balance":100000.0}`.

```powershell
# Deposit into Bob's account
curl -X POST http://localhost:8000/accounts/$BOB_ACCT/deposit `
  -H "Authorization: Bearer $BOB_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"amount":5000}'
```

---

## Step 8: Normal Transfer (COMPLETED)

```powershell
# Alice sends ₹5,000 to Bob — small amount, should pass fraud check
curl -X POST http://localhost:8000/transfers `
  -H "Authorization: Bearer $ALICE_TOKEN" `
  -H "Content-Type: application/json" `
  -H "Idempotency-Key: $(New-Guid)" `
  -d "{`"sender_account_id`":`"$ALICE_ACCT`",`"receiver_account_id`":`"$BOB_ACCT`",`"amount`":5000}"
```

**Expected:** `201` with:
```json
{
  "id": "uuid",
  "status": "COMPLETED",
  "amount": 5000.0,
  "risk_score": 0.0
}
```

```powershell
# Verify both balances updated atomically
curl http://localhost:8000/accounts/$ALICE_ACCT/balance -H "Authorization: Bearer $ALICE_TOKEN"
# Expected: 95000.0

curl http://localhost:8000/accounts/$BOB_ACCT/balance -H "Authorization: Bearer $BOB_TOKEN"
# Expected: 10000.0
```

---

## Step 9: Idempotency Check

```powershell
# Send the same transfer TWICE with identical Idempotency-Key
$KEY = [System.Guid]::NewGuid().ToString()

curl -X POST http://localhost:8000/transfers `
  -H "Authorization: Bearer $ALICE_TOKEN" `
  -H "Content-Type: application/json" `
  -H "Idempotency-Key: $KEY" `
  -d "{`"sender_account_id`":`"$ALICE_ACCT`",`"receiver_account_id`":`"$BOB_ACCT`",`"amount`":1000}"

# Repeat with the same key
curl -X POST http://localhost:8000/transfers `
  -H "Authorization: Bearer $ALICE_TOKEN" `
  -H "Content-Type: application/json" `
  -H "Idempotency-Key: $KEY" `
  -d "{`"sender_account_id`":`"$ALICE_ACCT`",`"receiver_account_id`":`"$BOB_ACCT`",`"amount`":1000}"
```

**Expected:** Both calls return the **identical** transfer object. Alice's balance decreases by ₹1,000 only once.

---

## Step 10: Fraud-Flagged Transfer (FLAGGED)

```powershell
# Alice tries to send ₹75,000 — above the ₹50,000 rule-based threshold
curl -X POST http://localhost:8000/transfers `
  -H "Authorization: Bearer $ALICE_TOKEN" `
  -H "Content-Type: application/json" `
  -H "Idempotency-Key: $(New-Guid)" `
  -d "{`"sender_account_id`":`"$ALICE_ACCT`",`"receiver_account_id`":`"$BOB_ACCT`",`"amount`":75000}"
```

**Expected:** `403`
```json
{
  "detail": "Transaction blocked — flagged by fraud detection",
  "risk_score": 0.85,
  "transfer_id": "uuid"
}
```

> **Note:** The ML model is trained on the Amount feature primarily. If the model lets a large amount through, the rule-based fallback (threshold ₹50,000) will block it as a safety net.

---

## Step 11: Insufficient Balance (FAILED)

```powershell
curl -X POST http://localhost:8000/transfers `
  -H "Authorization: Bearer $ALICE_TOKEN" `
  -H "Content-Type: application/json" `
  -H "Idempotency-Key: $(New-Guid)" `
  -d "{`"sender_account_id`":`"$ALICE_ACCT`",`"receiver_account_id`":`"$BOB_ACCT`",`"amount`":999999}"
```

**Expected:** `400` — `"Insufficient balance"`. A `FAILED` transfer record is still written to DB.

---

## Step 12: Same-Account Transfer (Validation)

```powershell
curl -X POST http://localhost:8000/transfers `
  -H "Authorization: Bearer $ALICE_TOKEN" `
  -H "Content-Type: application/json" `
  -H "Idempotency-Key: $(New-Guid)" `
  -d "{`"sender_account_id`":`"$ALICE_ACCT`",`"receiver_account_id`":`"$ALICE_ACCT`",`"amount`":100}"
```

**Expected:** `400` — `"Cannot transfer to the same account"`.

---

## Step 13: Transfer History

```powershell
# All transfers involving Alice (as sender or receiver)
curl http://localhost:8000/transfers/history/all `
  -H "Authorization: Bearer $ALICE_TOKEN"
```

**Expected:** JSON array. Each entry has `status` (COMPLETED / FLAGGED / FAILED) and `risk_score`.

```powershell
# Get a specific transfer by ID
curl http://localhost:8000/transfers/PASTE_TRANSFER_ID_HERE `
  -H "Authorization: Bearer $ALICE_TOKEN"
```

---

## Step 14: Double-Entry Ledger

```powershell
# View Alice's ledger (all DEBIT/CREDIT entries)
curl http://localhost:8000/ledger/$ALICE_ACCT `
  -H "Authorization: Bearer $ALICE_TOKEN"
```

**Expected:** Array of ledger entries with `entry_type` (DEBIT/CREDIT), `amount`, and `transfer_id`.

```powershell
# Verify ledger mathematical integrity
curl http://localhost:8000/ledger/verify/integrity `
  -H "Authorization: Bearer $ALICE_TOKEN"
```

**Expected:**
```json
{"balanced": true, "total_debits": 6000.0, "total_credits": 6000.0}
```

Proves that total debits == total credits across the entire ledger (no money creation or destruction).

---

## Step 15: Audit Chain Verification

```powershell
curl http://localhost:8000/audit/verify `
  -H "Authorization: Bearer $ALICE_TOKEN"
```

**Expected:**
```json
{
  "intact": true,
  "message": "Chain intact ✅ — all N entries verified",
  "total_entries": 3,
  "tamper_position": null
}
```

---

## Step 16: Async Worker (RabbitMQ)

```powershell
# Check the async-worker received and processed events
docker logs async-worker --tail 20
```

**Expected:**
```
📝 Processing transfer event: id=... amount=5000.00 status=COMPLETED
✅ Event processed successfully: ...
```

```powershell
# Open RabbitMQ Management UI: http://localhost:15672
# Credentials are from your .env file
# Check: queue "transfer_events" exists and has delivery activity
```

---

## Step 17: Prometheus Metrics

```powershell
curl http://localhost:8000/metrics
```

**Expected:** Prometheus text format containing:
- `http_requests_total` — counts by endpoint + status code
- `http_request_duration_seconds` — latency histogram
- `http_requests_in_progress` — concurrent request gauge

Open **Prometheus UI** at http://localhost:9090 → Status → Targets → verify `sentinelclear-api` is **UP**.

---

## Step 18: Grafana Dashboard

```
URL:      http://localhost:3000
Username: admin
Password: (from your .env — GF_SECURITY_ADMIN_PASSWORD)
```

1. Settings → Data Sources → `Prometheus` should show ✅ Connected
2. Dashboards → Browse → open `SentinelClear` dashboard
3. Panels should show live request rate, latency (p50/p95/p99), and error rates

---

## Step 19: Fallback Mode (ML Model Unavailable)

```powershell
# Stop the api-gateway
docker compose stop api-gateway

# Rename the model file to simulate unavailability
Rename-Item -Path "model/fraud_model.pkl" -NewName "fraud_model.pkl.bak"

# Restart the gateway
docker compose start api-gateway

# Wait a few seconds, then check logs
docker logs api-gateway 2>&1 | Select-String "fallback"
```

**Expected:** `"Model file not found — using rule-based fallback"`.

```powershell
# Small transfer — should succeed (rule-based allows <₹50,000)
curl -X POST http://localhost:8000/transfers `
  -H "Authorization: Bearer $ALICE_TOKEN" `
  -H "Content-Type: application/json" `
  -H "Idempotency-Key: $(New-Guid)" `
  -d "{`"sender_account_id`":`"$ALICE_ACCT`",`"receiver_account_id`":`"$BOB_ACCT`",`"amount`":1000}"
# Expected: 201 COMPLETED

# Large transfer — should be blocked by rule-based fallback
curl -X POST http://localhost:8000/transfers `
  -H "Authorization: Bearer $ALICE_TOKEN" `
  -H "Content-Type: application/json" `
  -H "Idempotency-Key: $(New-Guid)" `
  -d "{`"sender_account_id`":`"$ALICE_ACCT`",`"receiver_account_id`":`"$BOB_ACCT`",`"amount`":60000}"
# Expected: 403 FLAGGED
```

```powershell
# Restore the model
Rename-Item -Path "model/fraud_model.pkl.bak" -NewName "fraud_model.pkl"
docker compose restart api-gateway
```

---

## Step 20: Direct Database Inspection

```powershell
docker exec -it postgres-db psql -U sentinel -d sentinelclear
```

```sql
-- Users
SELECT id, username, email, created_at FROM users;

-- Accounts and balances
SELECT id, owner_id, account_type, balance FROM accounts;

-- Transfers with fraud scores
SELECT id, amount, status, risk_score, created_at FROM transfers ORDER BY created_at DESC LIMIT 10;

-- Audit chain
SELECT id, transfer_id, action, previous_hash, current_hash FROM audit_logs ORDER BY id;

-- Double-entry ledger
SELECT id, account_id, entry_type, amount, transfer_id FROM ledger_entries ORDER BY id;

\q
```

---

## Quick Reference — All Endpoints

| Method | Endpoint                           | Auth | Purpose                        |
|--------|------------------------------------|------|--------------------------------|
| POST   | `/auth/register`                   | ❌   | Create user                    |
| POST   | `/auth/login`                      | ❌   | Get JWT token                  |
| POST   | `/accounts`                        | ✅   | Create account                 |
| GET    | `/accounts/{id}/balance`           | ✅   | Check balance                  |
| POST   | `/accounts/{id}/deposit`           | ✅   | Deposit money                  |
| POST   | `/transfers`                       | ✅   | Execute transfer               |
| GET    | `/transfers/{id}`                  | ✅   | Get transfer detail            |
| GET    | `/transfers/history/all`           | ✅   | Full transfer history          |
| GET    | `/ledger/{account_id}`             | ✅   | Account ledger statement       |
| GET    | `/ledger/verify/integrity`         | ✅   | Verify debit == credit         |
| GET    | `/audit/verify`                    | ✅   | Verify SHA-256 audit chain     |
| POST   | `/ai/translate-statement`          | ✅   | Translate to Indian languages  |
| POST   | `/ai/insights`                     | ✅   | AI spending insights           |
| POST   | `/ai/fraud-explain/{transfer_id}`  | ✅   | AI fraud explanation           |
| GET    | `/health`                          | ❌   | System health check            |
| GET    | `/metrics`                         | ❌   | Prometheus metrics             |
| GET    | `/docs`                            | ❌   | Swagger UI                     |
| GET    | `/redoc`                           | ❌   | ReDoc                          |
