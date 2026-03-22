# SentinelClear — Complete Testing Guide

Step-by-step commands to test **every feature** of the project.  
Run all commands in PowerShell from the project root (`c:\MAJOR\SentinelClear`).

---

## Step 0: Build & Start Everything

```powershell
# Build all containers from scratch
docker compose build --no-cache

# Start all 6 containers
docker compose up -d

# Wait ~15 seconds for databases and RabbitMQ to become healthy, then verify
docker compose ps
```

**Expected:** Six containers running — `postgres-db`, `rabbitmq`, `api-gateway`, `async-worker`, `prometheus`, `grafana`.

```powershell
# Check api-gateway logs for ML model loading
docker logs api-gateway 2>&1 | Select-String "fraud|model|fallback"
```

**Expected:** You should see `"ML fraud model loaded"` and `"Fraud detection service ready"`. If you see `"rule-based fallback"`, the model file wasn't mounted — check the volume mount.

---

## Step 1: System Health

```powershell
curl http://localhost:8000/health
```

**Expected:**
```json
{"status":"healthy","database":"healthy","rabbitmq":"healthy"}
```

---

## Step 2: API Documentation

Open in browser:
- **Swagger UI:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc:** [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **OpenAPI JSON:** [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json)

**Expected:** All endpoints listed with request/response schemas.

---

## Step 3: User Registration

```powershell
# Register User 1 (Alice)
curl -X POST http://localhost:8000/auth/register `
  -H "Content-Type: application/json" `
  -d '{"username":"alice","email":"alice@test.com","password":"pass123"}'
```

**Expected:** `201` with user JSON (id, username, email, created_at).

```powershell
# Register User 2 (Bob)
curl -X POST http://localhost:8000/auth/register `
  -H "Content-Type: application/json" `
  -d '{"username":"bob","email":"bob@test.com","password":"pass456"}'
```

```powershell
# Test duplicate registration (should fail)
curl -X POST http://localhost:8000/auth/register `
  -H "Content-Type: application/json" `
  -d '{"username":"alice","email":"alice@test.com","password":"pass123"}'
```

**Expected:** `400` — `"Username or email already registered"`.

---

## Step 4: User Login + JWT Token

```powershell
# Login as Alice
curl -X POST http://localhost:8000/auth/login `
  -H "Content-Type: application/json" `
  -d '{"username":"alice","password":"pass123"}'
```

**Expected:** `200` with `{"access_token":"eyJ...","token_type":"bearer"}`.

> **Save the token!** Copy the `access_token` value and use it below:

```powershell
# Set tokens as variables for convenience
$ALICE_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzIiwiZXhwIjoxNzczMDUzMDU5fQ.Kl0GGEBJIVtR2ky1oaztwNnx0787moj4LI-LrGgM1Yk"
$BOB_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0IiwiZXhwIjoxNzczMDUyODA0fQ.luMRLc259h0PXHmZ-H7ZT-P6TdJlIhdqbuCUel6NNJc"
```

(Login as Bob too and save his token.)

```powershell
# Test wrong password (should fail)
curl -X POST http://localhost:8000/auth/login `
  -H "Content-Type: application/json" `
  -d '{"username":"alice","password":"wrongpass"}'
```

**Expected:** `401` — `"Invalid username or password"`.

---

## Step 5: Token-Protected Route (No Token)

```powershell
# Try accessing accounts without a token
curl http://localhost:8000/accounts/test/balance
```

**Expected:** `401`/`403` — proves that routes are protected.

---

## Step 6: Account Management

```powershell
# Create Alice's savings account
curl -X POST http://localhost:8000/accounts `
  -H "Authorization: Bearer $ALICE_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"account_type":"savings"}'
```

**Expected:** `201` with account JSON (id = UUID, balance = 0.0).

> **Save** Alice's `account_id` → `1f67dbfc-b314-4a2b-bbc5-3aee52a5c156`,   `009e99c5-662e-478e-ba01-7d2487161090`

```powershell
# Create a second account for Alice (checking)
curl -X POST http://localhost:8000/accounts `
  -H "Authorization: Bearer $ALICE_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"account_type":"checking"}'
```

**Expected:** Second account created — proves multiple accounts per user.

```powershell
# Create Bob's account
curl -X POST http://localhost:8000/accounts `
  -H "Authorization: Bearer $BOB_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"account_type":"savings"}'
```

> **Save** Bob's `account_id` → `$BOB_ACCT`

```powershell
# Set account IDs as variables
$ALICE_ACCT = "PASTE_ALICE_ACCOUNT_ID_HERE"
$BOB_ACCT = "e34fa547-5044-403f-9877-ee72a562b7d3"
```

---

## Step 7: Deposits & Balance

```powershell
# Deposit ₹100,000 into Alice's account
curl -X POST http://localhost:8000/accounts/$ALICE_ACCT/deposit `
  -H "Authorization: Bearer $ALICE_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"amount":100000}'
```

**Expected:** Account with `balance: 100000.0`.

```powershell
# Check balance
curl http://localhost:8000/accounts/$ALICE_ACCT/balance `
  -H "Authorization: Bearer $ALICE_TOKEN"
```

**Expected:** `{"account_id":"...","balance":100000.0}`.

```powershell
# Deposit into Bob's account too
curl -X POST http://localhost:8000/accounts/$BOB_ACCT/deposit `
  -H "Authorization: Bearer $BOB_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"amount":5000}'
```

---

## Step 8: Normal Transfer (COMPLETED)

```powershell
# Alice sends ₹5,000 to Bob (small amount — should pass fraud check)
curl -X POST http://localhost:8000/transfers `
  -H "Authorization: Bearer $ALICE_TOKEN" `
  -H "Content-Type: application/json" `
  -d "{\"sender_account_id\":\"$ALICE_ACCT\",\"receiver_account_id\":\"$BOB_ACCT\",\"amount\":5000}"
```

**Expected:** `201` with:
```json
{
  "id": "uuid",
  "sender_account_id": "...",
  "receiver_account_id": "...",
  "amount": 5000.0,
  "status": "COMPLETED",
  "risk_score": 0.0,
  "created_at": "..."
}
```

> **Key check:** `risk_score` is present (ML model scored it) and `status` is `COMPLETED`.

```powershell
# Verify balances changed
curl http://localhost:8000/accounts/$ALICE_ACCT/balance -H "Authorization: Bearer $ALICE_TOKEN"
# Expected: 95000.0

curl http://localhost:8000/accounts/$BOB_ACCT/balance -H "Authorization: Bearer $BOB_TOKEN"
# Expected: 10000.0
```

---

## Step 9: Fraud-Flagged Transfer (FLAGGED)

The ML model's threshold is **0.31**. For very large amounts, the model may flag it. The rule-based fallback flags anything above ₹50,000. Test with a large amount:

```powershell
# Alice tries to send ₹75,000 to Bob (may be flagged by ML or fallback)
curl -X POST http://localhost:8000/transfers `
  -H "Authorization: Bearer $ALICE_TOKEN" `
  -H "Content-Type: application/json" `
  -d "{\"sender_account_id\":\"$ALICE_ACCT\",\"receiver_account_id\":\"$BOB_ACCT\",\"amount\":75000}"
```

**If ML flags it** → `403`:
```json
{
  "detail": "Transaction blocked — flagged by fraud detection",
  "risk_score": 0.85,
  "transfer_id": "uuid"
}
```

**If ML lets it through** → `201 COMPLETED` with risk_score (the ML model is smarter than a flat threshold — it may allow some large transfers).

> **Note:** The ML model was trained on Amount + Time only (V1-V28 zeroed). Its real-world threshold behavior depends on the Amount feature's learned patterns. If you want to guarantee a flag for testing, temporarily stop the container, remove `model/fraud_model.pkl`, and restart — the fallback will flag anything > ₹50,000.

---

## Step 10: Insufficient Balance Transfer (FAILED)

```powershell
# Alice tries to send more than her balance
curl -X POST http://localhost:8000/transfers `
  -H "Authorization: Bearer $ALICE_TOKEN" `
  -H "Content-Type: application/json" `
  -d "{\"sender_account_id\":\"$ALICE_ACCT\",\"receiver_account_id\":\"$BOB_ACCT\",\"amount\":999999}"
```

**Expected:** `400` — `"Insufficient balance"`. A FAILED record is created in the DB with `risk_score`.

---

## Step 11: Same-Account Transfer (Validation)

```powershell
curl -X POST http://localhost:8000/transfers `
  -H "Authorization: Bearer $ALICE_TOKEN" `
  -H "Content-Type: application/json" `
  -d "{\"sender_account_id\":\"$ALICE_ACCT\",\"receiver_account_id\":\"$ALICE_ACCT\",\"amount\":100}"
```

**Expected:** `400` — `"Cannot transfer to the same account"`.

---

## Step 12: Transaction History

```powershell
# Alice's full transfer history
curl http://localhost:8000/transfers/history/all `
  -H "Authorization: Bearer $ALICE_TOKEN"
```

**Expected:** JSON array of all transfers where Alice is sender or receiver. Each entry has `status` (COMPLETED / FLAGGED / FAILED) and `risk_score`.

```powershell
# Get a specific transfer by ID
curl http://localhost:8000/transfers/PASTE_TRANSFER_ID_HERE `
  -H "Authorization: Bearer $ALICE_TOKEN"
```

---

## Step 13: Audit Chain Verification

```powershell
# Verify the tamper-evident audit log chain
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

This proves every SHA-256 hash in the audit chain is valid.

---

## Step 14: Async Worker (RabbitMQ)

```powershell
# Check the async-worker logs
docker logs async-worker --tail 20
```

**Expected:** Lines like:
```
📝 Processing transfer event: id=... amount=5000.00 status=COMPLETED
✅ Event processed successfully: ...
```

This proves the RabbitMQ consumer is receiving and processing events.

```powershell
# Open RabbitMQ Management UI
# URL: http://localhost:15672
# Login: sentinel / sentinel_rabbit_2024 (or check your .env)
```

**Check:**
- Queue `transfer_events` exists
- Messages are being consumed (Deliver/Get rate > 0)

---

## Step 15: Prometheus Metrics

```powershell
# Raw metrics endpoint
curl http://localhost:8000/metrics
```

**Expected:** Prometheus text format with metrics like:
- `http_requests_total` — request counts by endpoint and status
- `http_request_duration_seconds` — latency histogram
- `http_requests_in_progress` — concurrent request gauge

```powershell
# Open Prometheus UI
# URL: http://localhost:9090
# Try query: http_requests_total
```

**Check:** Target `sentinelclear-api` is UP under Status → Targets.

---

## Step 16: Grafana Dashboard

```
URL: http://localhost:3000
Login: admin / admin
```

**Check:**
1. Data source `Prometheus` is connected (Settings → Data Sources)
2. SentinelClear dashboard exists (Dashboards → Browse)
3. Panels show live data for request rates, latency, error rates

---

## Step 17: Fallback Mode (ML Model Unavailable)

```powershell
# Stop the api-gateway
docker compose stop api-gateway

# Temporarily rename the model file
Rename-Item -Path "model/fraud_model.pkl" -NewName "fraud_model.pkl.bak"

# Restart the api-gateway
docker compose start api-gateway

# Wait a few seconds, then check logs
docker logs api-gateway 2>&1 | Select-String "fallback"
```

**Expected:** Log says `"Model file not found — using rule-based fallback"`.

```powershell
# Test: Small transfer should succeed
curl -X POST http://localhost:8000/transfers `
  -H "Authorization: Bearer $ALICE_TOKEN" `
  -H "Content-Type: application/json" `
  -d "{\"sender_account_id\":\"$ALICE_ACCT\",\"receiver_account_id\":\"$BOB_ACCT\",\"amount\":1000}"
# Expected: 201 COMPLETED

# Test: Large transfer (>50,000) should be blocked by rule-based fallback
curl -X POST http://localhost:8000/transfers `
  -H "Authorization: Bearer $ALICE_TOKEN" `
  -H "Content-Type: application/json" `
  -d "{\"sender_account_id\":\"$ALICE_ACCT\",\"receiver_account_id\":\"$BOB_ACCT\",\"amount\":60000}"
# Expected: 403 FLAGGED
```

```powershell
# Restore the model
Rename-Item -Path "model/fraud_model.pkl.bak" -NewName "fraud_model.pkl"
docker compose restart api-gateway
```

---

## Step 18: Database Inspection

```powershell
# Connect to PostgreSQL inside Docker
docker exec -it postgres-db psql -U sentinel -d sentinelclear
```

```sql
-- Check users
SELECT id, username, email FROM users;

-- Check accounts
SELECT id, owner_id, account_type, balance FROM accounts;

-- Check transfers (note the risk_score column)
SELECT id, sender_account_id, receiver_account_id, amount, status, risk_score FROM transfers;

-- Check audit log chain
SELECT id, transfer_id, action, previous_hash, current_hash FROM audit_logs ORDER BY id;

-- Exit
\q
```

---

## Quick Reference — All Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/auth/register` | ✗ | Create user |
| POST | `/auth/login` | ✗ | Get JWT token |
| POST | `/accounts` | ✓ | Create account |
| GET | `/accounts/{id}/balance` | ✓ | Check balance |
| POST | `/accounts/{id}/deposit` | ✓ | Deposit money |
| POST | `/transfers` | ✓ | Execute transfer |
| GET | `/transfers/{id}` | ✓ | Get transfer details |
| GET | `/transfers/history/all` | ✓ | Full transfer history |
| GET | `/audit/verify` | ✓ | Verify audit chain |
| GET | `/health` | ✗ | System health |
| GET | `/metrics` | ✗ | Prometheus metrics |
| GET | `/docs` | ✗ | Swagger UI |
| GET | `/redoc` | ✗ | ReDoc |
