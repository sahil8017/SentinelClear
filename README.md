# 🛡️ SentinelClear v2.0

**Production-grade banking backend** — double-entry ledger, idempotent transactions, ML fraud detection, hash-chained audit logs, Redis caching, rate limiting, DLQ fault tolerance, and Sarvam AI integration.

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

| Container      | Role                                      |
|----------------|-------------------------------------------|
| `api-gateway`  | FastAPI REST API (v2.0)                   |
| `postgres-db`  | PostgreSQL 16 — primary data store        |
| `rabbitmq`     | RabbitMQ 3.13 — messaging + DLQ topology  |
| `redis`        | Redis 7 — balance cache + rate limiter    |
| `async-worker` | RabbitMQ consumer with retry logic        |
| `prometheus`   | Metrics scraper (`/metrics`)              |
| `grafana`      | Live observability dashboards             |

---

## 🚀 Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose v2+

### Setup & Launch

```bash
# 1. Clone and enter the repo
git clone https://github.com/your-username/SentinelClear.git
cd SentinelClear

# 2. Create your environment file and fill in your secrets
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD, JWT_SECRET_KEY, SARVAM_API_KEY, etc.

# 3. Start all 7 containers
docker compose up --build -d

# 4. Verify all services are healthy (~20s)
docker compose ps

# 5. Run the end-to-end test suite
python tests/test_everything.py
```

### Access Points

| Service        | URL                           | Credentials              |
|----------------|-------------------------------|--------------------------|
| Swagger UI     | http://localhost:8000/docs    | —                        |
| API Health     | http://localhost:8000/health  | —                        |
| Prometheus     | http://localhost:9090         | —                        |
| Grafana        | http://localhost:3000         | admin / *(from .env)*    |
| RabbitMQ Mgmt  | http://localhost:15672        | sentinel / *(from .env)* |

---

## 📡 API Endpoints

### Authentication
| Method | Endpoint          | Description              | Auth |
|--------|-------------------|--------------------------|------|
| POST   | `/auth/register`  | Register new user        | ❌   |
| POST   | `/auth/login`     | Login → JWT access token | ❌   |

### Accounts
| Method | Endpoint                    | Description                     | Auth |
|--------|-----------------------------|---------------------------------|------|
| POST   | `/accounts`                 | Create bank account             | ✅   |
| GET    | `/accounts/{id}/balance`    | Balance read (Redis → Snap → DB)| ✅   |
| POST   | `/accounts/{id}/deposit`    | Deposit funds                   | ✅   |

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

### Audit
| Method | Endpoint        | Description                 | Auth |
|--------|-----------------|-----------------------------|------|
| GET    | `/audit/verify` | Verify SHA-256 chain        | ✅   |

### AI (Sarvam)
| Method | Endpoint                           | Description                      | Auth |
|--------|------------------------------------|------------------------------------|------|
| POST   | `/ai/translate-statement`          | Translate to 22+ Indian languages | ✅   |
| POST   | `/ai/insights`                     | AI spending pattern insights      | ✅   |
| POST   | `/ai/fraud-explain/{transfer_id}`  | Human-readable fraud explanation  | ✅   |

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
Send an `Idempotency-Key` header (UUIDv4) on `POST /transfers`. Duplicate requests return the cached original response. Keys expire after 24 hours (Redis TTL).

### ⚡ Concurrency Control
PostgreSQL `SELECT ... FOR UPDATE` with **deterministic lock ordering** (lower UUID first) prevents deadlocks under concurrent transfers.

### 🚨 Hybrid Fraud Detection
Random Forest (284K-transaction training set) + rule-based fallback. Scores above the tuned threshold (0.31) result in a `FLAGGED` + `403` response.

### 📜 Tamper-Proof Audit Logs
SHA-256 hash-chained entries. Each entry includes the previous entry's hash. `GET /audit/verify` walks the entire chain and reports any tampered position.

### 🔄 Event-Driven Architecture + DLQ
RabbitMQ publishes `transfer_events` for every transaction. Failed consumers retry 3× with exponential backoff. Permanently failed messages route to a Dead Letter Queue.

### ⚡ 3-Layer Redis Caching
Balance reads follow: **Redis (5min TTL) → BalanceSnapshot → Full DB query**. Cache is invalidated on every deposit and transfer.

### 🛑 Sliding-Window Rate Limiting
Redis-backed: 5 register/min, 10 login/min, 30 transfers/min. Returns `429` with `Retry-After` header.

### 🤖 Sarvam AI Integration
- **Translate** — Transaction narrations to Hindi, Tamil, Telugu, Bengali, and 18 more Indian languages
- **Insights** — AI-powered spending pattern analysis
- **Fraud Explain** — Plain-language explanations for flagged transactions

### 📊 Observability
Prometheus scrapes `/metrics` every 15s. Grafana dashboards show API latency, throughput, error rates, and per-endpoint statistics.

---

## 🔄 Transaction Pipeline

```
POST /transfers
  └─► Idempotency key check (Redis)
      └─► Fraud scoring (Random Forest → rule-based fallback)
          └─► SELECT FOR UPDATE (ordered locking, deadlock-safe)
              └─► Debit sender / Credit receiver (atomic)
                  └─► Double-entry ledger entries
                      └─► BalanceSnapshot update + Redis invalidation
                          └─► SHA-256 audit log entry
                              └─► RabbitMQ publish → Async Worker
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
├── alembic/versions/             # 001, 002, 003 migrations
├── app/
│   ├── main.py                   # FastAPI entry point
│   ├── config.py                 # Settings (pydantic-settings, env-sourced)
│   ├── database.py               # Async SQLAlchemy engine
│   ├── models.py                 # ORM models (User, Account, Transfer, …)
│   ├── schemas.py                # Pydantic request/response schemas
│   ├── dependencies.py           # JWT auth guard
│   ├── routers/
│   │   ├── auth.py               # Register & login (rate-limited)
│   │   ├── accounts.py           # Account CRUD (Redis-cached balance)
│   │   ├── transfers.py          # 9-step transfer pipeline
│   │   ├── ledger.py             # Double-entry statement & verification
│   │   ├── audit.py              # Hash-chain verification
│   │   └── ai.py                 # Sarvam AI endpoints
│   └── services/
│       ├── fraud.py              # ML + rule-based fraud scoring
│       ├── audit.py              # SHA-256 hash-chain writer
│       ├── ledger.py             # Double-entry accounting
│       ├── idempotency.py        # Idempotency key management
│       ├── cache.py              # Redis balance caching
│       ├── rate_limit.py         # Sliding-window rate limiter
│       ├── sarvam.py             # Sarvam AI HTTP client
│       └── rabbitmq.py           # Publisher + DLQ topology setup
├── worker/
│   ├── Dockerfile
│   └── consumer.py               # Event consumer + DLQ handler
├── model/
│   ├── train_model.py            # ML training script
│   ├── fraud_model.pkl           # Trained sklearn pipeline (gitignored)
│   └── threshold.json            # Tuned decision threshold (0.31)
├── tests/
│   └── test_everything.py        # 20-section end-to-end test suite
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
| AI               | Sarvam AI (translate + chat)         |
| Fraud Detection  | scikit-learn — Random Forest         |
| Monitoring       | Prometheus + Grafana                 |
| Containerisation | Docker Compose (7 containers)        |

---

## 🧪 Testing

```bash
# Full end-to-end suite (20 sections, 60+ assertions)
python tests/test_everything.py
```

Covers: health, Swagger, metrics, registration, login, token protection, account creation, deposits, idempotent transfers, double-entry ledger, ledger integrity, same-account validation, insufficient balance, fraud detection, transfer history, SHA-256 audit chain, Sarvam AI translation, AI insights, and ownership checks.

---

## 🛑 Teardown

```bash
docker compose down           # Stop containers, preserve volumes
docker compose down -v        # Stop + wipe all data volumes
```

---

## 🎯 Summary

> Production-grade fintech backend implementing double-entry accounting, idempotent APIs, ML-powered fraud detection (Random Forest + rule-based fallback), tamper-proof SHA-256 audit logs, 3-layer Redis caching, sliding-window rate limiting, Dead Letter Queue fault tolerance, and Sarvam AI NLP — ensuring financial consistency, complete auditability, and production observability.
