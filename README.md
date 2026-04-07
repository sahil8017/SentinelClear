# 🛡️ SentinelClear v3.0

**Production-grade banking backend** — double-entry ledger, idempotent transactions, multi-signal fraud detection, hash-chained audit logs, PDF statement generation, event-driven notifications, scheduled reconciliation, and complete observability.

Built with **FastAPI · PostgreSQL · RabbitMQ · Redis · Firebase Auth · React · Prometheus · Grafana**.

---

## Table of Contents

- [Architecture](#-architecture)
- [Quick Start](#-quick-start)
- [Firebase Authentication Setup](#-firebase-authentication-setup)
- [Frontend Setup](#-frontend-setup)
- [API Endpoint Documentation](#-api-endpoint-documentation)
- [Key Features](#-key-features)
- [Transaction Pipeline](#-transaction-pipeline)
- [Fraud Detection Engine](#-fraud-detection-engine)
- [Double-Entry Ledger](#-double-entry-ledger)
- [Idempotency Protocol](#-idempotency-protocol)
- [Audit Chain Verification](#-audit-chain-verification)
- [Event-Driven Architecture](#-event-driven-architecture)
- [Caching Strategy](#-caching-strategy)
- [Rate Limiting](#-rate-limiting)
- [Observability Stack](#-observability-stack)
- [Project Structure](#-project-structure)
- [Database Schema](#-database-schema)
- [Testing](#-testing)
- [Teardown](#-teardown)

---

## 🏗️ Architecture

```
                                    ┌──────────────────────┐
                                    │   React Frontend     │
                                    │   (Vite + TailwindCSS)│
                                    │   :5173              │
                                    └──────────┬───────────┘
                                               │ Axios + JWT
                                               ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Grafana    │◄────│  Prometheus  │◄────│  API Gateway │────►│   Firebase   │
│  :3000       │     │  :9090       │     │  (FastAPI)   │     │   Auth       │
└──────────────┘     └──────────────┘     │  :8000       │     └──────────────┘
                                          └──────┬───────┘
                                                 │
                        ┌────────────────────────┼──────────────────┬─────────────┐
                        │                        │                  │             │
                  ┌─────▼─────┐           ┌──────▼──────┐  ┌───────▼──────┐ ┌───▼────┐
                  │ PostgreSQL │           │  RabbitMQ   │  │ Async Worker │ │ Redis  │
                  │  :5432     │           │  :5672+DLQ  │  │ (Consumer)   │ │ :6379  │
                  └───────────┘           └─────────────┘  └──────────────┘ └────────┘
```

### Container Matrix (7 Containers)

| Container      | Role                                                  | Port(s)    |
|----------------|-------------------------------------------------------|------------|
| `api-gateway`  | FastAPI REST API + APScheduler reconciliation          | 8000       |
| `postgres-db`  | PostgreSQL 16 — primary data store                    | 5432       |
| `rabbitmq`     | RabbitMQ 3.13 — messaging + DLQ topology              | 5672/15672 |
| `redis`        | Redis 7 — balance cache + rate limiter                | 6379       |
| `async-worker` | RabbitMQ consumer — notifications + analytics         | —          |
| `prometheus`   | Metrics scraper (`/metrics` every 15s)                | 9090       |
| `grafana`      | Live observability dashboards                         | 3000       |

### Frontend Stack

| Technology       | Purpose                              |
|------------------|--------------------------------------|
| React 18         | Component framework                  |
| Vite 6           | Build tooling + HMR dev server       |
| TailwindCSS 4    | Utility-first styling                |
| Recharts         | Data visualization (charts)          |
| Axios            | HTTP client with JWT interceptors    |
| React Router v7  | Client-side routing                  |
| Firebase SDK     | Google Sign-In authentication        |

---

## 🚀 Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose v2+
- [Node.js](https://nodejs.org/) v18+ (for the frontend)
- A Firebase project with Google Sign-In enabled (see [Firebase Setup](#-firebase-authentication-setup))

### 1. Clone and Configure

```bash
git clone https://github.com/your-username/SentinelClear.git
cd SentinelClear

# Create environment file from template
cp .env.example .env
```

Edit `.env` with your values:

```env
# Database
POSTGRES_USER=sentinel
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=sentinelclear

# JWT (generate with: openssl rand -hex 32)
JWT_SECRET_KEY=your_64_character_secret_key

# RabbitMQ
RABBITMQ_DEFAULT_USER=sentinel
RABBITMQ_DEFAULT_PASS=sentinel_pass
```

### 2. Start Backend Services

```bash
# Build and launch all 7 containers
docker compose up --build -d

# Verify all services are healthy (~30s for full startup)
docker compose ps

# Check API gateway logs
docker logs api-gateway --tail 20
```

### 3. Seed Demo Data

```bash
# Run the comprehensive demo seed script
python tests/test_everything.py
```

This script executes 23 test sections with 80+ assertions, creating:
- User accounts with deposits
- Multiple transfers (completed, flagged, failed)
- Fraud detection triggers
- Audit log chain entries
- Notification events

### 4. Start Frontend

```bash
cd frontend
npm install
npm run dev -- --force
```

### 5. Access Points

| Service          | URL                           | Credentials          |
|------------------|-------------------------------|----------------------|
| **Frontend**     | http://localhost:5173          | Google Sign-In       |
| **Swagger UI**   | http://localhost:8000/docs     | —                    |
| **API Health**   | http://localhost:8000/health   | —                    |
| **Prometheus**   | http://localhost:9090          | —                    |
| **Grafana**      | http://localhost:3000          | admin / admin        |
| **RabbitMQ Mgmt**| http://localhost:15672         | sentinel / sentinel  |

---

## 🔥 Firebase Authentication Setup

SentinelClear uses Firebase Authentication for the frontend login flow. The backend verifies Firebase ID tokens and provisions users in the local PostgreSQL database.

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project named `SentinelClear`
3. Navigate to **Authentication → Sign-in method**
4. Enable **Google** as a sign-in provider

### 2. Get Frontend Credentials

1. In Firebase Console → **Project Settings → General**
2. Under **Your apps**, click **Add app → Web**
3. Copy the Firebase config object

### 3. Configure Frontend `.env`

Create `frontend/.env`:

```env
VITE_FIREBASE_API_KEY="AIzaSy..."
VITE_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-project-id"
VITE_FIREBASE_STORAGE_BUCKET="your-project.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="123456789"
VITE_FIREBASE_APP_ID="1:123456789:web:abc123"

# Backend API — uses Vite proxy
VITE_API_BASE_URL="/api"
```

### 4. Get Backend Service Account

1. In Firebase Console → **Project Settings → Service accounts**
2. Click **Generate new private key**
3. Save the JSON file as `service-account.json` in the project root

### 5. Docker Integration

The `docker-compose.yml` is pre-configured to mount the service account:

```yaml
api-gateway:
  volumes:
    - ./service-account.json:/app/service-account.json:ro
  environment:
    - GOOGLE_APPLICATION_CREDENTIALS=/app/service-account.json
```

---

## 🖥️ Frontend Setup

### Development

```bash
cd frontend
npm install
npm run dev -- --force    # --force clears Vite cache
```

The Vite dev server proxies `/api/*` requests to `http://localhost:8000` automatically (configured in `vite.config.js`).

### Production Build

```bash
cd frontend
npm run build             # Output in dist/
npm run preview           # Preview production build
```

### Key Frontend Routes

| Route                      | Component        | Description                    |
|----------------------------|------------------|--------------------------------|
| `/`                        | Home             | Landing page                   |
| `/login`                   | Login            | Firebase Google Sign-In        |
| `/register`                | Register         | Traditional registration       |
| `/dashboard`               | Dashboard        | Command center with live data  |
| `/transfer`                | Transfer         | Execute new transfers          |
| `/ledger`                  | Ledger           | Double-entry transaction log   |
| `/analytics`               | FraudAnalytics   | Fraud detection dashboard      |
| `/ops`                     | OpsDashboard     | Operations monitoring          |
| `/docs`                    | Docs             | Interactive documentation      |
| `/docs/:section`           | Docs             | Section-specific documentation |

---

## 📡 API Endpoint Documentation

### Authentication

| Method | Endpoint                 | Description                    | Auth | Request Body                                        | Response                        |
|--------|--------------------------|--------------------------------|------|----------------------------------------------------|---------------------------------|
| POST   | `/auth/register`         | Register new user              | ❌   | `{"username": "str", "email": "str", "password": "str"}` | `{"access_token": "jwt", "token_type": "bearer"}` |
| POST   | `/auth/login`            | Login → JWT access token       | ❌   | `{"username": "str", "password": "str"}`           | `{"access_token": "jwt", "token_type": "bearer"}` |
| POST   | `/auth/firebase-login`   | Firebase token → JWT exchange  | ❌   | `{"id_token": "firebase_token_string"}`            | `{"access_token": "jwt", "token_type": "bearer"}` |

### Accounts

| Method | Endpoint                        | Description                        | Auth | Request / Params                          | Response Schema        |
|--------|---------------------------------|------------------------------------|------|------------------------------------------|------------------------|
| POST   | `/accounts`                     | Create bank account                | ✅   | `{"account_type": "savings"}`            | `AccountOut`           |
| GET    | `/accounts/me`                  | Get user's primary account         | ✅   | —                                         | `AccountOut`           |
| GET    | `/accounts/{id}/balance`        | Balance (Redis → Snapshot → DB)    | ✅   | Path: `account_id`                       | `BalanceOut`           |
| POST   | `/accounts/{id}/deposit`        | Deposit funds                      | ✅   | `{"amount": 1000.00}`                    | `AccountOut`           |
| GET    | `/accounts/{id}/statement`      | Download PDF statement             | ✅   | Query: `days=30`                         | PDF binary             |

**`AccountOut` Schema:**
```json
{
  "id": "uuid-string",
  "owner_id": 1,
  "account_type": "savings",
  "balance": 50000.00,
  "created_at": "2026-04-01T00:00:00Z"
}
```

### Transfers

| Method | Endpoint                    | Description                     | Auth | Request Body / Headers                              |
|--------|-----------------------------|---------------------------------|------|-----------------------------------------------------|
| POST   | `/transfers`                | Execute idempotent transfer     | ✅   | `{"sender_account_id": "uuid", "receiver_account_id": "uuid", "amount": 500.00}` + `Idempotency-Key: uuid` header |
| GET    | `/transfers/{id}`           | Get transfer details            | ✅   | Path: `transfer_id`                                 |
| GET    | `/transfers/history/all`    | Full transfer history           | ✅   | Query: `limit=50`                                   |

**`TransferOut` Schema:**
```json
{
  "id": "transfer-uuid",
  "sender_account_id": "uuid",
  "receiver_account_id": "uuid",
  "amount": 500.00,
  "status": "COMPLETED | FLAGGED | FAILED",
  "risk_score": 0.15,
  "fraud_rules_triggered": "[\"velocity\"]",
  "created_at": "2026-04-01T12:00:00Z"
}
```

### Double-Entry Ledger

| Method | Endpoint                    | Description                     | Auth |
|--------|-----------------------------|---------------------------------|------|
| GET    | `/ledger/{account_id}`      | Account ledger statement        | ✅   |
| GET    | `/ledger/verify/integrity`  | Verify total debits == credits  | ✅   |

**`LedgerVerifyResponse`:**
```json
{
  "balanced": true,
  "total_debits": 125000.00,
  "total_credits": 125000.00,
  "difference": 0.0,
  "total_entries": 84,
  "message": "Ledger integrity verified — debits equal credits"
}
```

### Fraud Detection

| Method | Endpoint                    | Description                         | Auth |
|--------|-----------------------------|-------------------------------------|------|
| GET    | `/fraud/dashboard`          | Real-time fraud analytics           | ✅   |
| GET    | `/fraud/rules`              | List all fraud rules + weights      | ✅   |
| PUT    | `/fraud/rules/{name}`       | Tune rule weights at runtime        | ✅   |

**`FraudDashboardResponse`:**
```json
{
  "total_transfers": 142,
  "completed": 130,
  "flagged": 8,
  "failed": 4,
  "flagged_rate": 0.0563,
  "top_rules_triggered": [{"rule": "velocity", "count": 5}],
  "recent_flagged": ["...TransferOut[]"],
  "risk_distribution": {"low": 100, "medium": 25, "high": 12, "critical": 5}
}
```

### Audit

| Method | Endpoint        | Description                     | Auth |
|--------|-----------------|---------------------------------|------|
| GET    | `/audit/verify` | Verify SHA-256 chain integrity  | ✅   |

### Notifications

| Method | Endpoint                    | Description                     | Auth |
|--------|-----------------------------|---------------------------------|------|
| GET    | `/notifications`            | User notification feed          | ✅   |
| GET    | `/notifications/count`      | Unread count                    | ✅   |
| PATCH  | `/notifications/read`       | Mark specific as read           | ✅   |
| PATCH  | `/notifications/read-all`   | Mark all as read                | ✅   |

### Analytics

| Method | Endpoint                        | Description                     | Auth |
|--------|---------------------------------|---------------------------------|------|
| GET    | `/analytics/daily/{account_id}` | Per-account daily breakdown     | ✅   |

### Admin

| Method | Endpoint                    | Description                        | Auth |
|--------|-----------------------------|------------------------------------|------|
| POST   | `/admin/reconciliation`     | Trigger balance reconciliation     | ❌   |

### System

| Method | Endpoint    | Description                   | Auth |
|--------|-------------|-------------------------------|------|
| GET    | `/metrics`  | Raw Prometheus metrics        | ❌   |
| GET    | `/health`   | DB + RabbitMQ + Redis status  | ❌   |

---

## ⚙️ Key Features

### 💸 Double-Entry Ledger
Every transfer atomically creates paired DEBIT + CREDIT entries. `GET /ledger/verify/integrity` guarantees no money is created or destroyed. The system uses PostgreSQL `SELECT ... FOR UPDATE` with **deterministic lock ordering** (lower UUID first) to prevent deadlocks.

### 🔁 Idempotent Transactions
Send an `Idempotency-Key` header (UUIDv4) on `POST /transfers`. Duplicate requests return the cached original response. Keys expire after 24 hours. This prevents double-spending in distributed systems where network retries are common.

### 🚨 Multi-Signal Fraud Detection
Six independent rules, each scoring a different behavioural signal (see [Fraud Detection Engine](#-fraud-detection-engine)).

### 📜 Tamper-Proof Audit Logs
SHA-256 hash-chained entries where each entry includes the previous entry's hash. Manual tampering is detectable via `GET /audit/verify`.

### 🔄 Event-Driven Architecture + DLQ
RabbitMQ publishes `transfer_events` for every transaction. Failed messages retry 3× with exponential backoff before routing to the Dead Letter Queue.

### ⚡ 3-Layer Redis Caching
Balance reads: **Redis (5min TTL) → BalanceSnapshot → Full DB query**. Cache invalidated on every deposit and transfer.

### 🛑 Sliding-Window Rate Limiting
Redis-backed: 5 register/min, 10 login/min, 30 transfers/min. Returns `429` with `Retry-After` header.

### 📄 PDF Statement Generation
`GET /accounts/{id}/statement` generates professional bank statements with account details, transaction table with running balance, summary totals, and audit chain hash using ReportLab.

### 🔔 Real-time Notifications
Every transfer event generates user notifications via the async RabbitMQ worker. Feed with unread counts and mark-read functionality.

### 📊 Daily Analytics
Per-account daily statistics aggregated by the async worker. Available via `GET /analytics/daily/{account_id}`.

### 🔄 Scheduled Reconciliation
APScheduler runs balance integrity checks every 24 hours, walking all accounts and flagging discrepancies.

### 📊 Full Observability
Prometheus scrapes `/metrics` every 15s. Grafana dashboards show API latency, throughput, error rates, and per-endpoint statistics.

---

## 🔄 Transaction Pipeline

```
POST /transfers
  └─► STEP 0: Idempotency key check (DB lookup)
      └─► STEP 1: Rule-based fraud scoring (6 signals)
          ├─► Decision: BLOCK → FLAGGED transfer + audit + 403 response
          └─► Decision: ALLOW
              └─► STEP 2: SELECT FOR UPDATE (ordered locking, deadlock-safe)
                  └─► Atomic debit sender / credit receiver
                      └─► STEP 3: Double-entry ledger entries (DEBIT + CREDIT)
                          └─► STEP 4: BalanceSnapshot upsert
                              └─► STEP 5: Redis cache invalidation
                                  └─► Audit log entry (SHA-256 chained)
                                      └─► RabbitMQ publish → Async Worker
                                          ├─► Notification (sender)
                                          ├─► Notification (receiver)
                                          ├─► Fraud alert (if flagged)
                                          └─► Daily analytics aggregation
```

---

## 🚨 Fraud Detection Engine

### Rule Matrix

| Rule                      | Signal                     | What It Catches                | Default Threshold        |
|---------------------------|----------------------------|--------------------------------|--------------------------|
| **Amount Threshold**      | Single transaction value   | High-value transactions        | > $10,000                |
| **Velocity**              | Transfer frequency         | Too many transfers rapidly     | > 10 in 10 minutes       |
| **Daily Volume**          | Cumulative daily outflow   | Structuring / money laundering | > $50,000/day            |
| **New Account**           | Account age + amount       | New accounts, large transfers  | < 7 days + > $5,000      |
| **Time-of-Day**           | Transaction hour           | Unusual hours activity         | 1:00 AM – 5:00 AM        |
| **Recipient Concentration** | Same-target frequency    | Split-structuring patterns     | > 5 to same recipient/day|

### Scoring Algorithm

Each rule produces an independent score weighted by its configurable weight. The final risk score is a weighted average normalized to `[0, 1]`:

```
risk_score = Σ(rule_score × rule_weight) / Σ(rule_weight)
```

### Decision Thresholds

| Risk Score Range | Decision | Action                              |
|------------------|----------|-------------------------------------|
| 0.0 – 0.49      | ALLOW    | Transfer proceeds normally          |
| 0.5 – 0.74      | REVIEW   | Transfer executes, flagged for review|
| 0.75 – 1.0      | BLOCK    | Transfer blocked, status = FLAGGED  |

### Runtime Tuning (No Redeployment)

```bash
# List current rule weights
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/fraud/rules

# Tune velocity rule weight to 2.0
curl -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"weight": 2.0, "enabled": true}' \
  http://localhost:8000/fraud/rules/velocity
```

---

## 💰 Double-Entry Ledger

Every transfer generates exactly two `LedgerEntry` records:

| Entry     | Account  | Amount   | Balance After |
|-----------|----------|----------|---------------|
| DEBIT     | Sender   | -500.00  | 9,500.00      |
| CREDIT    | Receiver | +500.00  | 10,500.00     |

**Atomic invariant**: At any point in time, `SUM(DEBIT) == SUM(CREDIT)`. Verified by:

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/ledger/verify/integrity
```

---

## 🔑 Idempotency Protocol

```
Client ──[POST /transfers + Idempotency-Key: abc123]──► Server
                                                           │
                                                    ┌──────┴──────┐
                                                    │ Key exists?  │
                                                    └──────┬──────┘
                                                   NO      │      YES
                                              ┌────┘       │       └────┐
                                         Create key    Processing?   Completed?
                                         (PENDING)        │              │
                                              │        Return 409   Return cached
                                         Execute tx                 response
                                              │
                                         Mark DONE
                                         Cache response
```

Keys expire after 24 hours. This ensures at-most-once execution semantics.

---

## 🔒 Audit Chain Verification

Each audit entry stores:

```json
{
  "entity_id": "transfer-uuid",
  "action": "TRANSFER_COMPLETED",
  "previous_hash": "sha256-of-previous-entry",
  "current_hash": "sha256(timestamp + entity_id + action + metadata + previous_hash)",
  "actor": "user:1",
  "metadata": {"amount": 500, "risk_score": 0.12}
}
```

**Verification**: `GET /audit/verify` walks the chain sequentially. If any entry's recomputed hash doesn't match, the exact tampered position is reported.

---

## 📨 Event-Driven Architecture

```
Transfer Completed
       │
       ▼
  RabbitMQ Exchange ──► transfer_events queue ──► Async Worker
       │                                              │
       │                                    ┌─────────┼─────────┐
       │                                    ▼         ▼         ▼
       │                              Notification  Notification  Daily
       │                              (Sender)     (Receiver)   Analytics
       │
       └──► Dead Letter Exchange ──► transfer_events_dlq
                                          │
                                     Retry 3× with
                                     exponential backoff
                                          │
                                     Max retries exceeded
                                          │
                                     Alert + Log
```

---

## ⚡ Caching Strategy

```
GET /accounts/{id}/balance
       │
       ▼
  ┌─────────────┐     MISS     ┌──────────────────┐     MISS     ┌────────────┐
  │  Redis Cache │────────────►│  BalanceSnapshot  │────────────►│  Full DB   │
  │  (5min TTL)  │             │  (Last snapshot)  │             │  Query     │
  └──────┬──────┘             └────────┬─────────┘             └─────┬──────┘
         │ HIT                         │ HIT                         │ HIT
         ▼                             ▼                             ▼
    Return balance              Populate Redis              Populate Redis
                                Return balance              Return balance
```

Cache is **invalidated** on every `POST /transfers` and `POST /accounts/{id}/deposit`.

---

## 🛑 Rate Limiting

| Endpoint       | Limit          | Window    | Response on Exceed     |
|----------------|----------------|-----------|------------------------|
| `/auth/register` | 5 requests   | 1 minute  | `429 + Retry-After`    |
| `/auth/login`    | 10 requests  | 1 minute  | `429 + Retry-After`    |
| `/transfers`     | 30 requests  | 1 minute  | `429 + Retry-After`    |

Implemented as a Redis-backed sliding window counter.

---

## 📊 Observability Stack

| Component    | Endpoint          | Description                        |
|--------------|-------------------|------------------------------------|
| Prometheus   | `:9090`           | Scrapes `/metrics` every 15s       |
| Grafana      | `:3000`           | Dashboards (API latency, errors)   |
| `/metrics`   | `:8000/metrics`   | Raw Prometheus format              |
| `/health`    | `:8000/health`    | DB + RMQ + Redis connectivity      |

---

## 📁 Project Structure

```
SentinelClear/
├── docker-compose.yml            # 7-container orchestration
├── Dockerfile                    # API gateway image
├── .env.example                  # Environment variable template
├── service-account.json          # Firebase Admin SDK credentials (gitignored)
├── requirements.txt              # Python dependencies
├── alembic.ini                   # Migration config
├── alembic/versions/             # 001–004 migrations
│
├── app/                          # FastAPI Backend
│   ├── main.py                   # Entry point + CORS + reconciliation scheduler
│   ├── config.py                 # Settings (fraud rules, Redis, DB, JWT)
│   ├── database.py               # Async SQLAlchemy engine
│   ├── models.py                 # 9 ORM models
│   ├── schemas.py                # Pydantic request/response schemas
│   ├── dependencies.py           # JWT auth guard
│   ├── routers/
│   │   ├── auth.py               # Register, login, Firebase token exchange
│   │   ├── accounts.py           # Account CRUD (Redis-cached balance)
│   │   ├── transfers.py          # 9-step atomic transfer pipeline
│   │   ├── ledger.py             # Double-entry statement & verification
│   │   ├── audit.py              # Hash-chain verification
│   │   ├── fraud.py              # Fraud dashboard + rule config
│   │   ├── notifications.py      # Notification feed
│   │   ├── analytics.py          # Daily analytics
│   │   ├── statement.py          # PDF statement export
│   │   ├── websocket.py          # WebSocket real-time updates
│   │   └── chaos.py              # Chaos engineering endpoints
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
│
├── frontend/                     # React Frontend
│   ├── src/
│   │   ├── App.jsx               # Router + Theme provider
│   │   ├── lib/
│   │   │   ├── axios.js          # Axios client with JWT interceptors
│   │   │   ├── auth.js           # Token storage utilities
│   │   │   └── firebase.js       # Firebase SDK initialization
│   │   ├── pages/
│   │   │   ├── Home.jsx          # Landing page
│   │   │   ├── Login.jsx         # Firebase Google Sign-In
│   │   │   ├── Dashboard.jsx     # Command center (live API data)
│   │   │   ├── Transfer.jsx      # Transfer execution
│   │   │   ├── Ledger.jsx        # Ledger viewer
│   │   │   ├── FraudAnalytics.jsx# Fraud dashboard
│   │   │   ├── Docs.jsx          # Interactive documentation
│   │   │   └── ...
│   │   └── components/
│   │       ├── Layout.jsx        # Authenticated layout wrapper
│   │       ├── Navbar.jsx        # Navigation with notification badge
│   │       └── ProtectedRoute.jsx# Route guard
│   ├── vite.config.js            # Vite + proxy configuration
│   └── package.json
│
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

## 🗃️ Database Schema

### Entity Relationship

```
User (1) ──────► (N) Account
Account (1) ────► (N) Transfer (as sender)
Account (1) ────► (N) Transfer (as receiver)
Transfer (1) ───► (2) LedgerEntry (DEBIT + CREDIT)
Transfer (1) ───► (N) AuditLog
User (1) ───────► (N) Notification
Account (1) ────► (N) AccountDailyStat
Account (1) ────► (1) BalanceSnapshot
```

### Models

| Model              | Key Fields                                          | Purpose                             |
|--------------------|-----------------------------------------------------|-------------------------------------|
| `User`             | `id`, `username`, `email`, `hashed_password`        | Authentication                      |
| `Account`          | `id(UUID)`, `owner_id`, `balance`, `account_type`   | Bank account                        |
| `Transfer`         | `id(UUID)`, `sender_id`, `receiver_id`, `amount`, `status`, `risk_score` | Transaction record     |
| `LedgerEntry`      | `transfer_id`, `account_id`, `entry_type`, `amount`, `balance_after` | Double-entry book       |
| `AuditLog`         | `entity_id`, `action`, `previous_hash`, `current_hash` | Tamper-proof chain              |
| `BalanceSnapshot`  | `account_id`, `balance`, `snapshot_at`              | Fast balance reads                  |
| `Notification`     | `user_id`, `title`, `message`, `is_read`            | User notifications                  |
| `AccountDailyStat` | `account_id`, `stat_date`, `total_sent`, `total_received` | Daily aggregates             |
| `FraudRuleConfig`  | `rule_name`, `weight`, `enabled`, `threshold_value` | Runtime-tunable fraud rules         |
| `ReconciliationLog`| `run_at`, `accounts_checked`, `discrepancies_found` | Integrity audit results             |

---

## ⚙️ Tech Stack

| Layer            | Technology                           |
|------------------|--------------------------------------|
| Frontend         | React 18 + Vite 6 + TailwindCSS 4   |
| API Framework    | FastAPI 0.115 + Uvicorn              |
| Database         | PostgreSQL 16 + SQLAlchemy 2.0 async |
| Cache            | Redis 7 (aioredis)                   |
| Auth             | Firebase Auth + JWT (python-jose)    |
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

**Test Coverage:**
Health check, Swagger docs, Prometheus metrics, user registration, login flow, JWT protection, account creation, deposits, idempotent transfers, double-entry ledger verification, same-account validation, insufficient balance handling, fraud rule engine triggers, transfer history, SHA-256 audit chain integrity, fraud dashboard analytics, fraud rule runtime configuration, notification feed, daily analytics aggregation, PDF statement generation, balance reconciliation, and account ownership enforcement.

---

## 🛑 Teardown

```bash
docker compose down           # Stop containers, preserve volumes
docker compose down -v        # Stop + wipe all data volumes
```

---

## 🎯 Summary

> Production-grade fintech platform implementing double-entry accounting, idempotent APIs, multi-signal rule-based fraud detection with runtime-tunable weights, tamper-proof SHA-256 audit logs, 3-layer Redis caching, sliding-window rate limiting, Dead Letter Queue fault tolerance, PDF statement generation, event-driven notifications, daily analytics aggregation, scheduled balance reconciliation, Firebase authentication, React dashboard with live API integration — ensuring financial consistency, complete auditability, and production observability across a 7-container Docker orchestration.

---

## 📄 License

MIT © 2026 SentinelClear
