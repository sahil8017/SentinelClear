# 🧪 SentinelClear Testing & Demo Guide

This document is your **cheat sheet** for demonstrating SentinelClear during a viva or project evaluation. It outlines exactly how to show off the system's core capabilities in a live scenario, proving that the architecture works under the hood.

---

## 🚀 Quick Verification

Before your demo, ensure all containers are running and the automated test suite passes:

```bash
# Start the system
docker compose up -d

# Wait 15-20 seconds, then run the test suite
python tests/test_everything.py
```

If the test script outputs `🎉 ALL TESTS PASSED!` (81/81 assertions), your environment is perfectly configured and ready to demo.

---

## 🎯 Viva Demo Scenarios

These specific scenarios highlight the "systems design" thinking that separates this from a basic CRUD app.

### 1. The Rule-Based Fraud Engine (Closed-Loop)
**Goal:** Prove the system can detect suspicious behaviour, block the transaction, and that you can dynamically tune the business logic *without restarting the server*.

1. **Setup:** Have Alice and Bob accounts ready (or create them via Swagger UI at `http://localhost:8000/docs`).
2. **Trigger Velocity Fraud:**
   - Make 6 quick transfers of ₹100 from Alice to Bob.
   - On the 6th transfer, the API will hit the velocity rule and return `403 Forbidden` with a flag decision.
3. **Show Observability:**
   - Go to `GET /fraud/dashboard`. Show the examiner that the `flagged_rate` has increased and `velocity` is listed in `top_rules_triggered`.
4. **Tune the Rule (The "Wow" Factor):**
   - Explain that hardcoded weights are bad practice.
   - Go to `PUT /fraud/rules/velocity` and change the `weight` from `1.5` to `0.5` (or disable it entirely: `enabled: false`).
   - Run the transfer again. It should now pass (or just trigger a `REVIEW` instead of `BLOCK` depending on other rules).

### 2. The Tamper-Proof Audit Log
**Goal:** Prove the system guarantees data integrity using cryptographic hash chains.

1. **Setup:** Make a few normal transfers via Swagger so the audit log has data.
2. **Verify the Chain:**
   - Call `GET /audit/verify`. It will return `"intact": true` and the number of entries checked.
3. **Simulate a Hack:**
   - Open a terminal and connect to the Postgres database:
     ```bash
     docker exec -it sentinelclear-postgres-db-1 psql -U sentinel -d sentinelclear
     ```
   - Maliciously alter a transfer amount in the audit log:
     ```sql
     UPDATE audit_logs SET details = replace(details, '"amount": 5000', '"amount": 90000') WHERE id = 2;
     ```
   - Exit Postgres (`\q`).
4. **Catch the Hacker:**
   - Call `GET /audit/verify` again.
   - The system will immediately flag `"intact": false` and tell you *exactly* which row (`first_tampered_at: 2`) had its content altered or linkage broken.

### 3. The Double-Entry Ledger & Reconciliation
**Goal:** Prove no money is created or destroyed, and that the system continually verifies its own correctness.

1. **Setup:** Alice has ₹10,000. Bob has ₹0. Alice transfers ₹1,000 to Bob.
2. **Show the Ledger:**
   - Call `GET /ledger/{alice_id}`. Show the examiner the `DEBIT` entry of ₹1,000 and the resulting `balance_after` of ₹9,000.
   - Call `GET /ledger/{bob_id}`. Show the corresponding `CREDIT` entry of ₹1,000.
3. **Trigger Reconciliation:**
   - Call `POST /admin/reconciliation`.
   - Explain that this walks *every* account and recomputes the balance from the raw ledger entries.
   - It will return `PASSED` with 0 discrepancies, proving financial integrity.

### 4. Async Event Processing
**Goal:** Prove the system is decoupled and uses RabbitMQ for background tasks.

1. **Setup:** Ensure you have the terminal logs visible for the `async-worker` container:
   ```bash
   docker compose logs -f async-worker
   ```
2. **Action:**
   - Make a transfer via Swagger.
3. **Result:**
   - Immediately look at the worker logs. You'll see it pick up the event and process the notifications and analytics.
   - Make an API call to `GET /notifications`. Show that the sender received a "Transfer Sent" notification and the receiver got a "Transfer Received" notification.
   - Call `GET /analytics/daily/{account_id}`. Show that the daily sent/received totals have updated in the background without blocking the main transfer API request.

### 5. PDF Statement Generation
**Goal:** Show a tangible, real-world output artifact.

1. **Action:**
   - Call `GET /accounts/{account_id}/statement?days=30` via your browser or Swagger (click the download link in Swagger).
2. **Result:**
   - Open the downloaded PDF.
   - Point out the transaction table, the running balances, and crucially, point to the very bottom: the **Audit Chain Hash**. Explain that if an examiner wants to verify this paper statement, that hash ties directly back to the tamper-proof ledger.

---

## 🛠️ Swagger UI Workflow (Manual Testing)

If you prefer to click through the API rather than running scripts, follow this exact sequence in the Swagger UI (`http://localhost:8000/docs`):

1. **Auth:** Complete `/auth/register`, then `/auth/login`. Copy the `access_token` and click the green "Authorize" button at the top of Swagger.
2. **Create Accounts:** POST to `/accounts` twice (creates one for you). To simulate another user, open an Incognito window, register User B, and create an account.
3. **Fund Account:** POST to `/accounts/{id}/deposit` to give User A money.
4. **Transfer:** POST to `/transfers`. Include the UUIDs and an amount. Add a random UUID to the `Idempotency-Key` header field to test safe replays.
5. **Check Ledgers:** GET `/ledger/{id}` to see the double-entry accounting at work.
6. **Check Fraud Dashboard:** GET `/fraud/dashboard` to see the global stats.

## 📡 Monitoring Tools

Don't forget to show the examiner the operational side of the project:
*   **RabbitMQ Dashboard:** `http://localhost:15672` (sentinel / your_secure_rabbitmq_password) — show the `transfer_events` queue queueing and unqueueing messages.
*   **Prometheus Metrics:** `http://localhost:8000/metrics` — show the raw text metrics output.
*   **Grafana Dashboard:** `http://localhost:3000` — show live API traffic visualisations.
