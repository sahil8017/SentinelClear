# 🛡️ SentinelClear v3.0

**Production-grade banking backend** — double-entry ledger, idempotent transactions, multi-signal fraud detection, hash-chained audit logs, PDF statement generation, event-driven notifications, scheduled reconciliation, and complete observability.

Built with **FastAPI · PostgreSQL · RabbitMQ · Redis · Prometheus · Grafana**.

---

## 🏗️ Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Grafana    │◄────│  Prometheus  │◄────│  API Gateway │
│  :3000       │     │  :9090       │     │  (FastAPI)   │
└──────────────┘     └──────────────┘     │  :8000       │
                                          └──────┬───────┘
                                                 │
                        ┌────────────────────────┼──────────────────┬─────────────┐
                        │                        │                  │             │
                  ┌─────▼─────┐           ┌──────▼──────┐  ┌───────▼──────┐ ┌───▼────┐
                  │ PostgreSQL │           │  RabbitMQ   │  │ Async Worker │ │ Redis  │
                  │  :5432     │           │  :5672+DLQ  │  │ (Consumer)   │ │ :6379  │
                  └───────────┘           └─────────────┘  └──────────────┘ └────────┘
```

### Containers (7)

| Container      | Role                                              |
|----------------|---------------------------------------------------|
| `api-gateway`  | FastAPI REST API (v3.0) + APScheduler reconciliation |
| `postgres-db`  | PostgreSQL 16 — primary data store                |
| `rabbitmq`     | RabbitMQ 3.13 — messaging + DLQ topology          |
| `redis`        | Redis 7 — balance cache + rate limiter            |
| `async-worker` | RabbitMQ consumer — notifications + analytics     |
| `prometheus`   | Metrics scraper (`/metrics`)                      |
| `grafana`      | Live observability dashboards                     |

---

## 🚀 Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose v2+

### Setup & Launch

```bash
# 1. Clone and enter the repo
git clone https://github.com/your-username/SentinelClear.git
cd SentinelClear

# 2. Create your environment file
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD, JWT_SECRET_KEY, etc.

# 3. Start all 7 containers
docker compose up --build -d

# 4. Verify all services are healthy (~20s)
docker compose ps

# 5. Run the end-to-end test suite (23 sections, 80+ assertions)
python tests/test_everything.py
```

### Access Points

| Service        | URL                           |
|----------------|-------------------------------|
| Swagger UI     | http://localhost:8000/docs    |
| API Health     | http://localhost:8000/health  |
| Prometheus     | http://localhost:9090         |
| Grafana        | http://localhost:3000         |
| RabbitMQ Mgmt  | http://localhost:15672        |

---

## 📡 API Endpoints

### Authentication
| Method | Endpoint          | Description              | Auth |
|--------|-------------------|--------------------------|------|
| POST   | `/auth/register`  | Register new user        | ❌   |
| POST   | `/auth/login`     | Login → JWT access token | ❌   |

### Accounts
| Method | Endpoint                        | Description                       | Auth |
|--------|---------------------------------|-----------------------------------|------|
| POST   | `/accounts`                     | Create bank account               | ✅   |
| GET    | `/accounts/{id}/balance`        | Balance (Redis → Snapshot → DB)   | ✅   |
| POST   | `/accounts/{id}/deposit`        | Deposit funds                     | ✅   |
| GET    | `/accounts/{id}/statement`      | **Download PDF statement**        | ✅   |

### Transfers
| Method | Endpoint                    | Description                     | Auth |
|--------|-----------------------------|---------------------------------|------|
| POST   | `/transfers`                | Execute idempotent transfer     | ✅   |
| GET    | `/transfers/{id}`           | Get transfer details            | ✅   |
| GET    | `/transfers/history/all`    | Full transfer history           | ✅   |

### Double-Entry Ledger
| Method | Endpoint                    | Description                     | Auth |
|--------|-----------------------------|---------------------------------|------|
| GET    | `/ledger/{account_id}`      | Account statement               | ✅   |
| GET    | `/ledger/verify/integrity`  | Verify debits == credits        | ✅   |

### Fraud Detection
| Method | Endpoint                    | Description                         | Auth |
|--------|-----------------------------|-------------------------------------|------|
| GET    | `/fraud/dashboard`          | **Real-time fraud analytics**       | ✅   |
| GET    | `/fraud/rules`              | **List all fraud rules + weights**  | ✅   |
| PUT    | `/fraud/rules/{name}`       | **Tune rule weights at runtime**    | ✅   |

### Audit
| Method | Endpoint        | Description                     | Auth |
|--------|-----------------|---------------------------------|------|
| GET    | `/audit/verify` | Verify SHA-256 chain integrity  | ✅   |

### Notifications
| Method | Endpoint                    | Description                     | Auth |
|--------|-----------------------------|---------------------------------|------|
| GET    | `/notifications`            | **User notification feed**      | ✅   |
| GET    | `/notifications/count`      | **Unread count**                | ✅   |
| PATCH  | `/notifications/read`       | **Mark specific as read**       | ✅   |
| PATCH  | `/notifications/read-all`   | **Mark all as read**            | ✅   |

### Analytics
| Method | Endpoint                        | Description                     | Auth |
|--------|---------------------------------|---------------------------------|------|
| GET    | `/analytics/daily/{account_id}` | **Per-account daily breakdown** | ✅   |

### Admin
| Method | Endpoint                    | Description                     | Auth |
|--------|-----------------------------|---------------------------------|------|
| POST   | `/admin/reconciliation`     | **Trigger balance reconciliation** | ❌ |

### System
| Method | Endpoint    | Description                   | Auth |
|--------|-------------|-------------------------------|------|
| GET    | `/metrics`  | Raw Prometheus metrics        | ❌   |
| GET    | `/health`   | DB + RabbitMQ + Redis status  | ❌   |

---

## ⚙️ Key Features

### 💸 Double-Entry Ledger
Every transfer atomically creates paired DEBIT + CREDIT entries. `GET /ledger/verify/integrity` guarantees no money is created or destroyed.

### 🔁 Idempotent Transactions
Send an `Idempotency-Key` header (UUIDv4) on `POST /transfers`. Duplicate requests return the cached original response. Keys expire after 24 hours.

### ⚡ Concurrency Control
PostgreSQL `SELECT ... FOR UPDATE` with **deterministic lock ordering** (lower UUID first) prevents deadlocks under concurrent transfers.

### 🚨 Multi-Signal Fraud Detection (Rule Engine)
Six independent rules, each scoring a different behavioural signal:

| Rule | Signal | What It Catches |
|------|--------|-----------------|
| **Amount Threshold** | Single transaction value | High-value transactions |
| **Velocity** | Transfer frequency | Too many transfers in 10 min |
| **Daily Volume** | Cumulative daily outflow | Structuring / money laundering |
| **New Account** | Account age + amount | New accounts making large transfers |
| **Time-of-Day** | Transaction hour | Unusual hours (1 AM – 5 AM) |
| **Recipient Concentration** | Same-target frequency | Split-structuring patterns |

Each rule's weight is **runtime-configurable** via `PUT /fraud/rules/{name}`, enabling a closed-loop **detect → review → tune → re-detect** workflow without redeployment.

### 📜 Tamper-Proof Audit Logs
SHA-256 hash-chained entries. Each entry includes the previous entry's hash. `GET /audit/verify` walks the entire chain and reports any tampered position. **Demo**: manually UPDATE a row in Postgres → the verifier catches it.

### 🔄 Event-Driven Architecture + DLQ
RabbitMQ publishes `transfer_events` for every transaction. The async worker creates **notifications** (sender/receiver/fraud alerts) and **daily analytics** aggregations. Failed messages retry 3× with exponential backoff before routing to the Dead Letter Queue.

### ⚡ 3-Layer Redis Caching
Balance reads follow: **Redis (5min TTL) → BalanceSnapshot → Full DB query**. Cache is invalidated on every deposit and transfer.

### 🛑 Sliding-Window Rate Limiting
Redis-backed: 5 register/min, 10 login/min, 30 transfers/min. Returns `429` with `Retry-After` header.

### 📄 PDF Statement Generation
`GET /accounts/{id}/statement` generates a professional bank statement with account details, transaction table with running balance, summary totals, and audit chain hash verification — using ReportLab (pure Python, no external service).

### 🔔 Notifications
Every transfer event (completed, flagged, failed) generates user notifications via the async RabbitMQ worker. Users get a notification feed with unread counts and mark-read functionality.

### 📊 Daily Analytics
Per-account daily statistics (total sent, received, transfer count, flagged count) aggregated by the async worker. Available via `GET /analytics/daily/{account_id}`.

### 🔄 Scheduled Reconciliation
APScheduler runs a balance integrity check every 24 hours, walking all accounts, recomputing balances from ledger entries, and flagging any discrepancies. Also available as a manual trigger via `POST /admin/reconciliation`.

### 📊 Observability
Prometheus scrapes `/metrics` every 15s. Grafana dashboards show API latency, throughput, error rates, and per-endpoint statistics.

---

## 🔄 Transaction Pipeline

```
POST /transfers
  └─► Idempotency key check (DB)
      └─► Rule-based fraud scoring (6 signals — velocity, amount, volume, age, time, recipient)
          └─► Decision: ALLOW / REVIEW / BLOCK
              └─► SELECT FOR UPDATE (ordered locking, deadlock-safe)
                  └─► Debit sender / Credit receiver (atomic)
                      └─► Double-entry ledger entries
                          └─► BalanceSnapshot update + Redis invalidation
                              └─► SHA-256 audit log entry
                                  └─► RabbitMQ publish → Async Worker
                                      ├─► Notifications (sender + receiver)
                                      └─► Daily analytics aggregation
```

---

## 📁 Project Structure

```
SentinelClear/
├── docker-compose.yml            # 7-container orchestration
├── Dockerfile                    # API gateway image
├── .env.example                  # Environment variable template
├── requirements.txt              # Python dependencies
├── alembic.ini                   # Migration config
├── alembic/versions/             # 001–004 migrations
├── app/
│   ├── main.py                   # FastAPI entry point + reconciliation scheduler
│   ├── config.py                 # Settings (fraud rules, Redis, DB, JWT)
│   ├── database.py               # Async SQLAlchemy engine
│   ├── models.py                 # 9 ORM models
│   ├── schemas.py                # Pydantic request/response schemas
│   ├── dependencies.py           # JWT auth guard
│   ├── routers/
│   │   ├── auth.py               # Register & login (rate-limited)
│   │   ├── accounts.py           # Account CRUD (Redis-cached balance)
│   │   ├── transfers.py          # 9-step transfer pipeline
│   │   ├── ledger.py             # Double-entry statement & verification
│   │   ├── audit.py              # Hash-chain verification
│   │   ├── fraud.py              # Fraud dashboard + rule config
│   │   ├── notifications.py      # Notification feed
│   │   ├── analytics.py          # Daily analytics
│   │   └── statement.py          # PDF statement export
│   └── services/
│       ├── fraud.py              # Rule engine orchestrator
│       ├── fraud_rules.py        # 6 individual fraud rules
│       ├── audit.py              # SHA-256 hash-chain writer + verifier
│       ├── ledger.py             # Double-entry accounting
│       ├── idempotency.py        # Idempotency key management
│       ├── cache.py              # Redis balance caching
│       ├── rate_limit.py         # Sliding-window rate limiter
│       ├── rabbitmq.py           # Publisher + DLQ topology setup
│       ├── pdf_statement.py      # ReportLab PDF generator
│       └── reconciliation.py     # Balance integrity checker
├── worker/
│   ├── Dockerfile
│   └── consumer.py               # Notifications + analytics worker
├── tests/
│   └── test_everything.py        # 23-section end-to-end test suite
└── monitoring/
    ├── prometheus.yml
    └── grafana/provisioning/
```

---

## ⚙️ Tech Stack

| Layer            | Technology                           |
|------------------|--------------------------------------|
| API Framework    | FastAPI 0.115 + Uvicorn              |
| Database         | PostgreSQL 16 + SQLAlchemy 2.0 async |
| Cache            | Redis 7 (aioredis)                   |
| Auth             | JWT (python-jose) + bcrypt           |
| Messaging        | RabbitMQ 3.13 + aio-pika + DLQ      |
| Fraud Detection  | Multi-signal rule engine (6 rules)   |
| PDF Generation   | ReportLab                            |
| Scheduling       | APScheduler                          |
| Monitoring       | Prometheus + Grafana                 |
| Containerisation | Docker Compose (7 containers)        |

---

## 🧪 Testing

```bash
# Full end-to-end suite (23 sections, 80+ assertions)
python tests/test_everything.py
```

Covers: health, Swagger, metrics, registration, login, token protection, account creation, deposits, idempotent transfers, double-entry ledger, ledger integrity, same-account validation, insufficient balance, fraud rule engine, transfer history, SHA-256 audit chain, fraud dashboard, fraud rule configuration, notifications, daily analytics, PDF statement, reconciliation, and ownership checks.

---

## 🛑 Teardown

```bash
docker compose down           # Stop containers, preserve volumes
docker compose down -v        # Stop + wipe all data volumes
```

---

## 🎯 Summary

> Production-grade fintech backend implementing double-entry accounting, idempotent APIs, multi-signal rule-based fraud detection with runtime-tunable weights, tamper-proof SHA-256 audit logs, 3-layer Redis caching, sliding-window rate limiting, Dead Letter Queue fault tolerance, PDF statement generation, event-driven notifications, daily analytics aggregation, and scheduled balance reconciliation — ensuring financial consistency, complete auditability, and production observability.
