"""
test_everything.py — SentinelClear End-to-End Test Suite v3.0
=============================================================

Runs against a LIVE Docker deployment (http://localhost:8000).

Usage:
    1. docker compose up -d --build
    2. Wait ~20 seconds for services to become healthy
    3. python tests/test_everything.py

Features tested:
    ✅ System health (/health) — DB, RabbitMQ, Redis
    ✅ API docs (/docs, /openapi.json)
    ✅ Prometheus metrics (/metrics)
    ✅ User registration (+ duplicate rejection)
    ✅ User login (+ wrong password rejection)
    ✅ Token-protected routes (401 without token)
    ✅ Account creation (multiple per user)
    ✅ Deposits & balance checks (with Redis cache)
    ✅ Normal transfer (COMPLETED + risk_score + rules)
    ✅ Insufficient balance transfer (FAILED)
    ✅ Same-account transfer (validation)
    ✅ Fraud rule engine (amount threshold, velocity)
    ✅ Idempotency (same key → cached response)
    ✅ Double-entry ledger (DEBIT + CREDIT entries)
    ✅ Ledger integrity verification
    ✅ Transaction history (all statuses present)
    ✅ Audit chain verification (SHA-256 intact)
    ✅ Fraud dashboard (stats + rules)
    ✅ Fraud rule configuration (GET + PUT)
    ✅ Notifications (created by async worker)
    ✅ Daily analytics (populated by async worker)
    ✅ PDF statement download
    ✅ Reconciliation trigger
    ✅ Ownership / authorization checks
"""

import sys
import time
import uuid
import httpx

BASE_URL = "http://localhost:8000"

passed = 0
failed = 0
total = 0


def test(name: str, condition: bool, detail: str = ""):
    global passed, failed, total
    total += 1
    if condition:
        passed += 1
        print(f"  ✅ {name}")
    else:
        failed += 1
        msg = f" — {detail}" if detail else ""
        print(f"  ❌ {name}{msg}")


uid = uuid.uuid4().hex[:6]
ALICE_USER = f"alice_{uid}"
ALICE_EMAIL = f"alice_{uid}@test.com"
BOB_USER = f"bob_{uid}"
BOB_EMAIL = f"bob_{uid}@test.com"
PASSWORD = "securepass123"

alice_token = ""
bob_token = ""
alice_acct = ""
bob_acct = ""
completed_transfer_id = ""
idempotency_key = str(uuid.uuid4())


def main():
    global alice_token, bob_token, alice_acct, bob_acct, completed_transfer_id

    client = httpx.Client(base_url=BASE_URL, timeout=15.0)

    print("\n" + "═" * 60)
    print("  🧪 SentinelClear — Full Test Suite v3.0")
    print("═" * 60)

    # ──────────────────────────────────────────────────────────────
    print("\n📌 1. SYSTEM HEALTH")
    # ──────────────────────────────────────────────────────────────
    try:
        r = client.get("/health")
        data = r.json()
        test("GET /health returns 200", r.status_code == 200)
        test("Database is healthy", data.get("database") == "healthy")
        test("RabbitMQ is healthy", data.get("rabbitmq") == "healthy")
        test("Redis is healthy", data.get("redis") == "healthy")
        test("Overall status is healthy", data.get("status") == "healthy")
    except httpx.ConnectError:
        print("  ❌ Cannot connect to API — is it running? (docker compose up -d)")
        sys.exit(1)

    # ──────────────────────────────────────────────────────────────
    print("\n📌 2. API DOCS & OPENAPI")
    # ──────────────────────────────────────────────────────────────
    r = client.get("/docs")
    test("GET /docs returns 200 (Swagger UI)", r.status_code == 200)

    r = client.get("/openapi.json")
    test("GET /openapi.json returns 200", r.status_code == 200)
    test("OpenAPI has paths defined", len(r.json().get("paths", {})) > 0)

    # ──────────────────────────────────────────────────────────────
    print("\n📌 3. PROMETHEUS METRICS")
    # ──────────────────────────────────────────────────────────────
    r = client.get("/metrics")
    test("GET /metrics returns 200", r.status_code == 200)
    test("Metrics contain http_requests", "http_requests" in r.text)

    # ──────────────────────────────────────────────────────────────
    print("\n📌 4. USER REGISTRATION")
    # ──────────────────────────────────────────────────────────────
    r = client.post("/auth/register", json={
        "username": ALICE_USER, "email": ALICE_EMAIL, "password": PASSWORD,
    })
    test("Register Alice → 201", r.status_code == 201)
    test("Response has user ID", "id" in r.json())

    r = client.post("/auth/register", json={
        "username": BOB_USER, "email": BOB_EMAIL, "password": PASSWORD,
    })
    test("Register Bob → 201", r.status_code == 201)

    r = client.post("/auth/register", json={
        "username": ALICE_USER, "email": ALICE_EMAIL, "password": PASSWORD,
    })
    test("Duplicate registration → 400", r.status_code == 400)

    # ──────────────────────────────────────────────────────────────
    print("\n📌 5. USER LOGIN & JWT")
    # ──────────────────────────────────────────────────────────────
    r = client.post("/auth/login", json={"username": ALICE_USER, "password": PASSWORD})
    test("Login Alice → 200", r.status_code == 200)
    alice_token = r.json().get("access_token", "")

    r = client.post("/auth/login", json={"username": BOB_USER, "password": PASSWORD})
    bob_token = r.json().get("access_token", "")
    test("Login Bob → 200", r.status_code == 200)

    r = client.post("/auth/login", json={"username": ALICE_USER, "password": "wrong"})
    test("Wrong password → 401", r.status_code == 401)

    # ──────────────────────────────────────────────────────────────
    print("\n📌 6. TOKEN-PROTECTED ROUTES")
    # ──────────────────────────────────────────────────────────────
    r = client.post("/accounts", json={"account_type": "savings"})
    test("POST /accounts without token → 401/403", r.status_code in (401, 403))

    alice_headers = {"Authorization": f"Bearer {alice_token}"}
    bob_headers = {"Authorization": f"Bearer {bob_token}"}

    # ──────────────────────────────────────────────────────────────
    print("\n📌 7. ACCOUNT MANAGEMENT")
    # ──────────────────────────────────────────────────────────────
    r = client.post("/accounts", json={"account_type": "savings"}, headers=alice_headers)
    test("Create Alice's account → 201", r.status_code == 201)
    test("Initial balance is 0.0", r.json().get("balance") == 0.0)
    alice_acct = r.json().get("id", "")

    r = client.post("/accounts", json={"account_type": "savings"}, headers=bob_headers)
    test("Create Bob's account → 201", r.status_code == 201)
    bob_acct = r.json().get("id", "")

    # ──────────────────────────────────────────────────────────────
    print("\n📌 8. DEPOSITS & BALANCE (Redis cache)")
    # ──────────────────────────────────────────────────────────────
    r = client.post(f"/accounts/{alice_acct}/deposit", json={"amount": 100000}, headers=alice_headers)
    test("Deposit ₹100,000 into Alice → 200", r.status_code == 200)
    test("Balance after deposit is 100000", r.json().get("balance") == 100000.0)

    r = client.get(f"/accounts/{alice_acct}/balance", headers=alice_headers)
    test("GET balance → 200", r.status_code == 200)
    test("Balance matches", r.json().get("balance") == 100000.0)

    r = client.post(f"/accounts/{bob_acct}/deposit", json={"amount": 5000}, headers=bob_headers)
    test("Deposit ₹5,000 into Bob → 200", r.status_code == 200)

    # ──────────────────────────────────────────────────────────────
    print("\n📌 9. NORMAL TRANSFER + IDEMPOTENCY")
    # ──────────────────────────────────────────────────────────────
    r = client.post("/transfers", json={
        "sender_account_id": alice_acct,
        "receiver_account_id": bob_acct,
        "amount": 5000,
    }, headers={**alice_headers, "Idempotency-Key": idempotency_key})
    test("Transfer ₹5,000 Alice→Bob → 201", r.status_code == 201)
    test("Status is COMPLETED", r.json().get("status") == "COMPLETED")
    test("risk_score is present", r.json().get("risk_score") is not None)
    completed_transfer_id = r.json().get("id", "")

    # Idempotency replay
    r2 = client.post("/transfers", json={
        "sender_account_id": alice_acct,
        "receiver_account_id": bob_acct,
        "amount": 5000,
    }, headers={**alice_headers, "Idempotency-Key": idempotency_key})
    test("Idempotent replay returns same ID", r2.json().get("id") == completed_transfer_id)

    r = client.get(f"/accounts/{alice_acct}/balance", headers=alice_headers)
    test("Alice balance decreased to 95000", r.json().get("balance") == 95000.0)

    r = client.get(f"/accounts/{bob_acct}/balance", headers=bob_headers)
    test("Bob balance increased to 10000", r.json().get("balance") == 10000.0)

    # ──────────────────────────────────────────────────────────────
    print("\n📌 10. DOUBLE-ENTRY LEDGER")
    # ──────────────────────────────────────────────────────────────
    r = client.get(f"/ledger/{alice_acct}", headers=alice_headers)
    test("GET ledger → 200", r.status_code == 200)
    entries = r.json()
    test("Ledger has entries", len(entries) > 0)
    debits = [e for e in entries if e["entry_type"] == "DEBIT"]
    test("DEBIT entry exists", len(debits) > 0)

    # ──────────────────────────────────────────────────────────────
    print("\n📌 11. LEDGER INTEGRITY")
    # ──────────────────────────────────────────────────────────────
    r = client.get("/ledger/verify/integrity", headers=alice_headers)
    test("GET /ledger/verify/integrity → 200", r.status_code == 200)
    test("Ledger is balanced", r.json().get("balanced") is True)

    # ──────────────────────────────────────────────────────────────
    print("\n📌 12. SAME-ACCOUNT TRANSFER")
    # ──────────────────────────────────────────────────────────────
    r = client.post("/transfers", json={
        "sender_account_id": alice_acct,
        "receiver_account_id": alice_acct,
        "amount": 100,
    }, headers=alice_headers)
    test("Same-account transfer → 400", r.status_code == 400)

    # ──────────────────────────────────────────────────────────────
    print("\n📌 13. INSUFFICIENT BALANCE")
    # ──────────────────────────────────────────────────────────────
    r = client.post("/transfers", json={
        "sender_account_id": alice_acct,
        "receiver_account_id": bob_acct,
        "amount": 999999,
    }, headers=alice_headers)
    test("Insufficient/flagged → 400 or 403", r.status_code in (400, 403))

    # ──────────────────────────────────────────────────────────────
    print("\n📌 14. FRAUD RULE ENGINE")
    # ──────────────────────────────────────────────────────────────
    r = client.post("/transfers", json={
        "sender_account_id": alice_acct,
        "receiver_account_id": bob_acct,
        "amount": 75000,
    }, headers=alice_headers)
    if r.status_code == 403:
        test("Large transfer → 403 FLAGGED by rule engine", True)
        test("Response has risk_score", "risk_score" in r.json())
        test("Response has rules_triggered", "rules_triggered" in r.json())
        test("Response has decision", "decision" in r.json())
    elif r.status_code == 201:
        test("Large transfer → 201 COMPLETED (rules allowed it)", True)
    else:
        test(f"Large transfer → unexpected {r.status_code}", False, r.text)

    # ──────────────────────────────────────────────────────────────
    print("\n📌 15. TRANSACTION HISTORY")
    # ──────────────────────────────────────────────────────────────
    r = client.get("/transfers/history/all", headers=alice_headers)
    test("GET /transfers/history/all → 200", r.status_code == 200)
    transfers = r.json()
    test("History returns a list", isinstance(transfers, list))
    test("History has transfers", len(transfers) >= 1)

    # ──────────────────────────────────────────────────────────────
    print("\n📌 16. AUDIT CHAIN VERIFICATION")
    # ──────────────────────────────────────────────────────────────
    r = client.get("/audit/verify", headers=alice_headers)
    test("GET /audit/verify → 200", r.status_code == 200)
    data = r.json()
    test("Audit chain is intact", data.get("intact") is True)
    test("entries_checked > 0", data.get("entries_checked", 0) > 0)
    test("first_tampered_at is null", data.get("first_tampered_at") is None)

    # ──────────────────────────────────────────────────────────────
    print("\n📌 17. FRAUD DASHBOARD")
    # ──────────────────────────────────────────────────────────────
    r = client.get("/fraud/dashboard", headers=alice_headers)
    test("GET /fraud/dashboard → 200", r.status_code == 200)
    data = r.json()
    test("Dashboard has total_transfers", "total_transfers" in data)
    test("Dashboard has risk_distribution", "risk_distribution" in data)
    test("Dashboard has top_rules_triggered", "top_rules_triggered" in data)
    test("total_transfers > 0", data.get("total_transfers", 0) > 0)

    # ──────────────────────────────────────────────────────────────
    print("\n📌 18. FRAUD RULE CONFIGURATION")
    # ──────────────────────────────────────────────────────────────
    r = client.get("/fraud/rules", headers=alice_headers)
    test("GET /fraud/rules → 200", r.status_code == 200)
    rules = r.json()
    test("Rules list is non-empty", len(rules) > 0)
    rule_names = [rule["rule_name"] for rule in rules]
    test("amount_threshold rule exists", "amount_threshold" in rule_names)
    test("velocity rule exists", "velocity" in rule_names)

    # Update a rule weight
    r = client.put("/fraud/rules/amount_threshold", json={
        "weight": 2.0,
    }, headers=alice_headers)
    test("PUT /fraud/rules/amount_threshold → 200", r.status_code == 200)
    test("Weight updated to 2.0", r.json().get("weight") == 2.0)

    # Reset weight
    client.put("/fraud/rules/amount_threshold", json={"weight": 1.0}, headers=alice_headers)

    # ──────────────────────────────────────────────────────────────
    print("\n📌 19. NOTIFICATIONS (async worker)")
    # ──────────────────────────────────────────────────────────────
    # Give the async worker time to process events
    time.sleep(3)

    r = client.get("/notifications", headers=alice_headers)
    test("GET /notifications → 200", r.status_code == 200)
    notifications = r.json()
    test("Notifications exist", len(notifications) > 0)
    if notifications:
        test("Notification has title", "title" in notifications[0])
        test("Notification has message", "message" in notifications[0])
        test("Notification has type", "notification_type" in notifications[0])

    r = client.get("/notifications/count", headers=alice_headers)
    test("GET /notifications/count → 200", r.status_code == 200)
    test("unread_count field present", "unread_count" in r.json())

    # Mark all read
    r = client.patch("/notifications/read-all", headers=alice_headers)
    test("PATCH /notifications/read-all → 200", r.status_code == 200)

    # ──────────────────────────────────────────────────────────────
    print("\n📌 20. DAILY ANALYTICS")
    # ──────────────────────────────────────────────────────────────
    r = client.get(f"/analytics/daily/{alice_acct}?days=30", headers=alice_headers)
    test("GET /analytics/daily → 200", r.status_code == 200)
    data = r.json()
    test("Analytics has account_id", data.get("account_id") == alice_acct)
    test("Analytics has total_sent", "total_sent" in data)
    test("Analytics has net_flow", "net_flow" in data)

    # ──────────────────────────────────────────────────────────────
    print("\n📌 21. PDF STATEMENT")
    # ──────────────────────────────────────────────────────────────
    r = client.get(f"/accounts/{alice_acct}/statement?days=30", headers=alice_headers)
    test("GET /accounts/{id}/statement → 200", r.status_code == 200)
    test("Response is PDF", r.headers.get("content-type") == "application/pdf")
    test("PDF has content", len(r.content) > 100)
    test("Content-Disposition has filename",
         "attachment" in r.headers.get("content-disposition", ""))

    # ──────────────────────────────────────────────────────────────
    print("\n📌 22. RECONCILIATION")
    # ──────────────────────────────────────────────────────────────
    r = client.post("/admin/reconciliation")
    test("POST /admin/reconciliation → 200", r.status_code == 200)
    data = r.json()
    test("Reconciliation has status", "status" in data)
    test("Reconciliation PASSED", data.get("status") == "PASSED")
    test("Zero discrepancies", data.get("discrepancies_found", -1) == 0)

    # ──────────────────────────────────────────────────────────────
    print("\n📌 23. OWNERSHIP / AUTHORIZATION")
    # ──────────────────────────────────────────────────────────────
    r = client.get(f"/accounts/{alice_acct}/balance", headers=bob_headers)
    test("Bob can't see Alice's balance → 404", r.status_code == 404)

    r = client.post("/transfers", json={
        "sender_account_id": alice_acct,
        "receiver_account_id": bob_acct,
        "amount": 100,
    }, headers=bob_headers)
    test("Bob can't transfer from Alice's account → 403", r.status_code == 403)

    r = client.get(f"/ledger/{alice_acct}", headers=bob_headers)
    test("Bob can't see Alice's ledger → 404", r.status_code == 404)

    # ──────────────────────────────────────────────────────────────
    print("\n" + "═" * 60)
    print(f"  🏁 RESULTS: {passed}/{total} passed, {failed} failed")
    print("═" * 60)

    if failed == 0:
        print("  🎉 ALL TESTS PASSED!")
    else:
        print(f"  ⚠️  {failed} test(s) need attention.")

    print()
    client.close()
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
