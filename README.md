# 🛡️ SentinelClear v2.0

**Production-grade banking backend** with double-entry ledger, idempotent transactions, ML fraud detection, hash-chained audit logs, Redis caching, rate limiting, DLQ fault tolerance, and Sarvam AI integration — built with FastAPI, PostgreSQL, RabbitMQ, Redis, Prometheus & Grafana.

---

## 🏗️ Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Grafana    │◄────│  Prometheus  │◄────│  API Gateway │
│  :3000       │     │  :9090       │     │  (FastAPI)   │
└──────────────┘     └──────────────┘     │  :8000       │
                                          └──────┬───────┘
                                                 │
                                    ┌────────────┼────────────┬────────────┐
                                    │            │            │            │
                              ┌─────▼─────┐ ┌───▼───┐ ┌─────▼─────┐ ┌────▼────┐
                              │ PostgreSQL │ │RabbitMQ│ │  Async    │ │  Redis  │
                              │ :5432      │ │ :5672  │ │  Worker   │ │  :6379  │
                              └───────────┘ │ + DLQ  │ └───────────┘ └─────────┘
                                            └────────┘
```

### Containers (7)

| Container      | What it runs                          |
|----------------|---------------------------------------|
| `api-gateway`  | FastAPI application (v2.0)            |
| `postgres-db`  | PostgreSQL 16 database                |
| `rabbitmq`     | RabbitMQ 3.13 + DLQ topology          |
| `redis`        | Redis 7 (balance cache, rate limiter) |
| `async-worker` | Event consumer with retry logic       |
| `prometheus`   | Metrics collector (scrapes /metrics)  |
| `grafana`      | Live monitoring dashboard             |

---

## 🚀 Quick Start

### Prerequisites
- **Docker** & **Docker Compose** installed

### Launch

```bash
cd SentinelClear

# 1. Setup environment variables (edit .env with your real keys)
cp .env.example .env

# 2. Start all 7 containers
docker compose up --build -d


# Wait ~20s for services to become healthy
docker compose ps

# Run the full test suite
python tests/test_everything.py
```

### Access Points

| Service         | URL                          |
|-----------------|------------------------------|
| API Docs        | http://localhost:8000/docs    |
| API Health      | http://localhost:8000/health  |
| Prometheus      | http://localhost:9090         |
| Grafana         | http://localhost:3000         |
| RabbitMQ Mgmt   | http://localhost:15672        |

> **Grafana credentials:** admin / admin
> **RabbitMQ credentials:** sentinel / sentinel_rabbit_2024

---

## 📡 API Endpoints

### Core Banking
| Method | Endpoint                    | Description                     | Auth |
|--------|-----------------------------|---------------------------------|------|
| POST   | `/auth/register`            | Register a new user             | ❌    |
| POST   | `/auth/login`               | Login, get JWT token            | ❌    |
| POST   | `/accounts`                 | Create a bank account           | ✅    |
| GET    | `/accounts/{id}/balance`    | Check balance (Redis-cached)    | ✅    |
| POST   | `/accounts/{id}/deposit`    | Deposit money                   | ✅    |
| POST   | `/transfers`                | Send money (idempotent)         | ✅    |
| GET    | `/transfers/{id}`           | Get one transaction detail      | ✅    |
| GET    | `/transfers/history/all`    | See all your transactions       | ✅    |

### Double-Entry Ledger
| Method | Endpoint                    | Description                     | Auth |
|--------|-----------------------------|---------------------------------|------|
| GET    | `/ledger/{account_id}`      | Account statement (all entries) | ✅    |
| GET    | `/ledger/verify/integrity`  | Verify debits == credits        | ✅    |

### Audit & Verification
| Method | Endpoint                    | Description                     | Auth |
|--------|-----------------------------|---------------------------------|------|
| GET    | `/audit/verify`             | Verify SHA-256 audit chain      | ✅    |

### AI (Sarvam)
| Method | Endpoint                           | Description                     | Auth |
|--------|------------------------------------|---------------------------------|------|
| POST   | `/ai/translate-statement`          | Translate text to Indian langs  | ✅    |
| POST   | `/ai/insights`                     | AI spending insights            | ✅    |
| POST   | `/ai/fraud-explain/{transfer_id}`  | AI fraud analysis explanation   | ✅    |

### System
| Method | Endpoint   | Description              | Auth |
|--------|------------|--------------------------|------|
| GET    | `/metrics` | Raw Prometheus metrics   | ❌    |
| GET    | `/health`  | System health (DB+RMQ+Redis) | ❌    |

---

## ⚙️ Key Features

### 💸 Double-Entry Ledger
Every transfer creates paired DEBIT + CREDIT entries. `GET /ledger/verify/integrity` ensures no money is created or destroyed — total debits must equal total credits.

### 🔁 Idempotent Transactions
Send an `Idempotency-Key` header on `POST /transfers`. Same key → same response. No duplicate transfers. Keys expire after 24 hours.

### ⚡ Concurrency Control
PostgreSQL `SELECT ... FOR UPDATE` with ordered lock acquisition prevents race conditions and deadlocks.

### 🚨 Hybrid Fraud Detection
ML model (Random Forest trained on 284K transactions) + rule-based fallback. Transactions scoring above the tuned threshold are **FLAGGED** and blocked.

### 📜 Tamper-Proof Audit Logs
SHA-256 hash-chained entries. Each log contains the hash of the previous entry. `GET /audit/verify` walks the entire chain.

### 🔄 Event-Driven + DLQ
RabbitMQ with Dead Letter Queue. Failed messages retry 3× with tracking via `x-death` headers. Permanently failed messages route to DLQ for alerting.

### ⚡ Redis Caching
3-layer balance reads: Redis (5min TTL) → BalanceSnapshot → DB. Cache invalidated on every transfer and deposit.

### 🛑 Rate Limiting
Redis-backed sliding window: 10 login/min, 5 register/min, 30 transfers/min. Returns 429 with `Retry-After` header.

### 🤖 Sarvam AI Integration
- **Translate** — Transaction narrations to 22+ Indian languages
- **Insights** — AI-powered spending pattern analysis
- **Fraud Explain** — Human-readable explanations for flagged transfers

### 📊 Observability
Prometheus metrics + Grafana dashboards for API latency, throughput, and error rates.

---

## 🔄 Transaction Flow

```
Request → Idempotency Check → Fraud Scoring (ML) → Atomic Transfer (FOR UPDATE)
  → Double-Entry Ledger → Balance Snapshots → Redis Invalidation
  → Audit Log (SHA-256) → RabbitMQ Event → Async Worker
```

---

## 📁 Project Structure

```
SentinelClear/
├── docker-compose.yml          # 7-container orchestration
├── Dockerfile                  # API gateway image
├── .env                        # Environment variables
├── requirements.txt            # Python dependencies
├── alembic.ini                 # Migration config
├── alembic/versions/           # 001, 002, 003 migrations
├── app/
│   ├── main.py                 # FastAPI entry point (v2.0)
│   ├── config.py               # Settings (DB, RMQ, Redis, Sarvam, JWT)
│   ├── database.py             # Async SQLAlchemy engine
│   ├── models.py               # 7 ORM models
│   ├── schemas.py              # Pydantic request/response schemas
│   ├── dependencies.py         # JWT auth guard
│   ├── routers/
│   │   ├── auth.py             # Register & login (rate-limited)
│   │   ├── accounts.py         # Account CRUD (Redis-cached)
│   │   ├── transfers.py        # 9-step transfer pipeline
│   │   ├── ledger.py           # Double-entry statement & verification
│   │   ├── audit.py            # Hash chain verification
│   │   └── ai.py               # Sarvam AI endpoints
│   └── services/
│       ├── fraud.py            # ML + rule-based fraud scoring
│       ├── audit.py            # SHA-256 hash chain
│       ├── ledger.py           # Double-entry accounting
│       ├── idempotency.py      # Idempotency key management
│       ├── cache.py            # Redis balance caching
│       ├── rate_limit.py       # Sliding window rate limiter
│       ├── sarvam.py           # Sarvam AI client
│       └── rabbitmq.py         # RabbitMQ publisher + DLQ
├── worker/
│   ├── Dockerfile
│   └── consumer.py             # Event consumer + DLQ handler
├── model/
│   ├── train_model.py          # ML training script
│   ├── fraud_model.pkl         # Trained sklearn pipeline
│   └── threshold.json          # Tuned decision threshold
├── tests/
│   └── test_everything.py      # 20-section end-to-end test suite
└── monitoring/
    ├── prometheus.yml
    └── grafana/provisioning/
```

---

## ⚙️ Tech Stack

| Layer           | Technology                        |
|-----------------|-----------------------------------|
| API             | FastAPI + Uvicorn                 |
| Database        | PostgreSQL 16 + SQLAlchemy 2.0    |
| Cache           | Redis 7                           |
| Auth            | JWT (python-jose) + bcrypt        |
| Messaging       | RabbitMQ + aio-pika + DLQ         |
| AI              | Sarvam AI (translate, chat)       |
| Fraud Detection | scikit-learn (Random Forest)      |
| Monitoring      | Prometheus + Grafana              |
| Containerisation| Docker Compose (7 containers)     |

---

## 🧪 Testing

```bash
# Run the full end-to-end test suite (20 sections, 60+ assertions)
python tests/test_everything.py
```

Tests cover: health, API docs, metrics, registration, login, token protection, accounts, deposits, transfers with idempotency, double-entry ledger, ledger integrity, same-account validation, insufficient balance, fraud detection, transaction history, audit chain, Sarvam AI translation, AI insights, and ownership checks.

---

## 🛑 Stopping

```bash
docker compose down           # Stop containers
docker compose down -v        # Stop + remove volumes (wipe data)
```

---

## 🎯 One-Line Summary

> Built a production-grade fintech backend with double-entry ledger, idempotent transactions, ML fraud detection, hash-chained audit logs, Redis caching, rate limiting, DLQ fault tolerance, and Sarvam AI integration — ensuring financial consistency and complete traceability.
