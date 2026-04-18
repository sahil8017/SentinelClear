<p align="center">
  <img src="https://img.shields.io/badge/SentinelClear-Financial%20OS-000000?style=for-the-badge&labelColor=000" alt="SentinelClear" />
</p>

<h1 align="center">SentinelClear</h1>

<p align="center">
  <strong>The AI-Powered, Cryptographically Auditable Financial Operating System.</strong>
</p>

<p align="center">
  Production-grade banking infrastructure with an immutable double-entry ledger, a three-layer hybrid fraud engine trained on 6.3M synthetic transactions, SHA-256 hash-chained audit logs, and enterprise compliance protocols — deployed as a containerized microservices architecture.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/PostgreSQL_16-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/RabbitMQ-FF6600?style=flat-square&logo=rabbitmq&logoColor=white" alt="RabbitMQ" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Scikit--Learn-F7931E?style=flat-square&logo=scikit-learn&logoColor=white" alt="Scikit-Learn" />
  <img src="https://img.shields.io/badge/Prometheus-E6522C?style=flat-square&logo=prometheus&logoColor=white" alt="Prometheus" />
  <img src="https://img.shields.io/badge/Grafana-F46800?style=flat-square&logo=grafana&logoColor=white" alt="Grafana" />
  <img src="https://img.shields.io/badge/Nginx-009639?style=flat-square&logo=nginx&logoColor=white" alt="Nginx" />
  <img src="https://img.shields.io/badge/Python_3.12-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/TailwindCSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind" />
</p>

---

## Why SentinelClear?

Legacy banking backends suffer from two critical architectural failures:

1.  **Mutable ledgers.** Traditional SQL tables allow direct `UPDATE` and `DELETE` operations on financial records. A rogue internal actor — or a compromised admin credential — can silently alter transaction history. There is no mathematical proof of integrity.

2.  **Static rule engines.** Fraud detection systems built on hardcoded IF/ELSE thresholds cannot adapt to adversarial drift. Sophisticated laundering patterns (structuring, money mule networks, impossible travel) bypass static rules entirely.

SentinelClear addresses both by fusing **immutable, hash-chained accounting** with a **three-layer hybrid AI risk engine** — and wrapping it in enterprise compliance protocols (Maker-Checker, Step-Up Auth, Automated STR generation) that meet real-world regulatory expectations.

> This is not a demo. Every transfer executes through atomic `SELECT ... FOR UPDATE` row-level locks, persists dual DEBIT/CREDIT ledger entries in a single SQL transaction, and appends a SHA-256 hash-linked audit record — before returning a response to the client.

---

## Core Architecture

### 1. Immutable Double-Entry Ledger

Every capital movement in SentinelClear produces **two** ledger entries — a `DEBIT` on the sender and a `CREDIT` on the receiver — within a single atomic database transaction. This is not optional middleware; it is the only path through which balances change.

```
Transfer ₹50,000 (Account A → Account B)
├── LedgerEntry { account: A, type: DEBIT,  amount: 50000, balance_after: 150000 }
├── LedgerEntry { account: B, type: CREDIT, amount: 50000, balance_after: 250000 }
├── AuditLog   { hash: sha256(prev_hash | transfer_id | action | details | timestamp) }
└── BalanceSnapshot { account: A, balance: 150000 } + { account: B, balance: 250000 }
```

**Hash-Chained Audit Trail:** Every event appended to `audit_logs` computes its `current_hash` as `SHA-256(previous_hash | transfer_id | action | details | timestamp)`. This creates a cryptographic chain identical in principle to a blockchain — any direct database mutation (row insertion, field alteration, deletion) breaks the chain and is mathematically detectable via the EOD verification endpoint.

**Concurrency Model:** All balance mutations acquire row-level `FOR UPDATE` locks in deterministic sort order (by account ID) to prevent deadlocks. The Chaos Monkey stress tester validates this by firing 50 simultaneous transactions at the same two accounts and proving zero negative balances and zero deadlocks.

---

### 2. Hybrid Risk Engine — Three Layers

SentinelClear's fraud detection pipeline is not a single model or a single rule set. It is a **layered composite** that combines regulatory hard-blocks, configurable heuristics, and a trained ML classifier.

```
Incoming Transfer
│
├─ Layer 1: Regulatory Hard-Blocks
│  └─ Frozen accounts, self-transfers, KYC violations → Instant 403
│
├─ Layer 2: Admin-Tunable Heuristic Rules (8 rules, weighted)
│  ├─ amount_threshold     (weight: 1.0)  — Single-transfer ceiling
│  ├─ velocity             (weight: 1.5)  — Transfer frequency in sliding window
│  ├─ burst_velocity       (weight: 2.0)  — 3+ transfers in 60 seconds
│  ├─ daily_volume         (weight: 1.2)  — Cumulative daily outflow limit
│  ├─ new_account          (weight: 1.3)  — New accounts making large transfers
│  ├─ time_of_day          (weight: 0.8)  — Unusual hours (01:00–05:00)
│  ├─ recipient_conc.      (weight: 1.0)  — Repeated transfers to same recipient
│  └─ impossible_travel    (weight: 2.0)  — Geospatial velocity > 1000 km/h
│
├─ Layer 3: ML Predictive Model (Random Forest)
│  ├─ Trained on 6.3M PaySim synthetic transaction rows
│  ├─ 9-feature vector: step, type, amount, balances, error deltas
│  └─ Returns P(fraud) probability + Explainable AI breakdown
│
└─ Composite Score: max(rule_score, ml_score × ops_multiplier)
   ├─ score ≥ 0.70 → BLOCK (Immediate quarantine, 403 response)
   ├─ score ≥ 0.40 → REVIEW (Step-Up Authentication challenge)
   └─ score < 0.40 → ALLOW (Execute transfer)
```

> **Explainable AI (XAI):** When the ML model triggers a block, SentinelClear does not return a black-box probability. It surfaces the specific causal factor — "Sender Ledger Overdraw Anomaly" or "Destination Structural Inflation" — directly in the UI, giving compliance officers actionable intelligence rather than opaque scores.

---

## Enterprise Features

### Compliance & Security

- **Maker-Checker Protocol (Four Eyes Principle):** Transfers exceeding ₹5,00,000 are automatically routed to `PENDING_APPROVAL` status. A separate administrator must explicitly approve or reject. The backend enforces cryptographic separation of duties.
- **Dynamic Step-Up Authentication:** Transfers scoring in the `REVIEW` band (0.40–0.70) are suspended in `PENDING_AUTH` state and require verification of a bcrypt-hashed transaction PIN.
- **Automated STR Generation:** Flagged transactions trigger automated Suspicious Transaction Report (STR) generation in PDF format — ready for Financial Intelligence Unit (FIU) submission.
- **Firebase Zero-Trust Authentication:** Authentication bridges Google Firebase SSO with a locally synchronized backend profile, supporting enterprise-grade security and social logins.

### Credit & Lending Engine

- **ML Credit Scoring:** Seamless integration of Scikit-Learn Random Forest models that analyze structural account telemetry to produce a probability of default and compute eligible loan limits up to ₹10,00,000.
- **Atomic Disbursements:** Once a loan is approved, the principal is disbursed directly to the user's account via atomic double-entry ledger mechanisms, preventing duplicate funding.
- **Risk-Based Pricing:** The final interest rate applied to a loan is dynamically derived from the underlying ML probability of default.

### UPI Safety Rules (RBI/NPCI Fraud Prevention)

- **Transaction Pause (Rule 1):** UPI transfers exceeding ₹10,000 are automatically paused in `PAUSED` status, requiring explicit user confirmation before funds are released. Users can whitelist trusted contacts bypass the pause.
- **Vulnerable Group Protection (Rule 2):** For users aged ≥70 or with disabilities, transactions above ₹50,000 require approval from a pre-designated **Trusted Person** (guardian) via in-app notification.
- **Emergency Kill Switch (Rule 3):** A panic button that instantly freezes ALL outgoing UPI payments. Deactivation requires PIN verification via Step-Up Auth.
- **Annual Receiving Limit (Rule 4):** Enforces a ₹25 Lakh annual receiving cap per account. The system tracks cumulative inbound credits and freezes accounts that exceed the limit.

### Threat Intelligence & Visualization

- **AML Money Mule Network Graph:** A topological visualization of capital flow across the entire system. Backend BFS clustering identifies connected components; the frontend renders an interactive pan/zoom graph.
- **Indian State-Based Impossible Travel:** Geospatial velocity checking mapped across Indian States. If a user initiates a transfer from Maharashtra and then from Delhi within a physically impossible timeframe (>1000 km/h), the transaction is flagged.

### Audit & Resilience

- **EOD Cryptographic Audit:** An admin-endpoint recomputes every SHA-256 hash against its predecessor in O(N) time. Direct database mutations are immediately detected.
- **Chaos Monkey Stress Tester:** A builtin concurrency tool fires 50 simultaneous double-entry transactions via `asyncio.gather`, proving the pessimistic locking model holds under extreme load.
- **Docker Optimized Deployments:** Multi-stage Docker builds reduce container image footprints by an average of 65%.

### Platform Infrastructure

- **Idempotent Transfers:** Optional `Idempotency-Key` header support prevents duplicate transaction execution on network retries.
- **Event-Driven Architecture:** RabbitMQ-backed async event publishing with Dead Letter Queue (DLQ) monitoring.
- **Redis Caching Layer:** Balance snapshots and hot-path queries are cached in Redis.
- **Prometheus + Grafana:** Request-level metrics instrumentation with custom dashboards.
- **PDF Statement Generation:** On-demand account statements generated server-side.

---

## System Architecture

```
                                    ┌─────────────┐
                                    │   Nginx     │ :80
                                    │  (Reverse   │
                                    │   Proxy)    │
                                    └──────┬──────┘
                               ┌───────────┴───────────┐
                               │                       │
                        ┌──────▼──────┐         ┌──────▼──────┐
                        │  React SPA  │         │  Grafana    │ :3000
                        │  (Vite)     │         │  Dashboards │
                        └─────────────┘         └──────┬──────┘
                                                       │
                        ┌──────────────────────────────▼──────┐
                        │         FastAPI Gateway             │ :8000
                        │  ┌─────────┬──────────┬──────────┐  │
                        │  │ Routers │ Services │ ML Model │  │
                        │  │ (REST)  │ (Domain) │ (RF/XAI) │  │
                        │  └────┬────┴─────┬────┴─────┬────┘  │
                        └───────┼──────────┼──────────┼───────┘
                     ┌──────────┼──────────┼──────────┘
                     │          │          │
              ┌──────▼───┐ ┌───▼────┐ ┌───▼──────┐
              │PostgreSQL│ │ Redis  │ │ RabbitMQ │
              │   16     │ │   7    │ │  3.13    │
              │ (Primary)│ │(Cache) │ │ (Events) │
              └──────────┘ └────────┘ └────┬─────┘
                                           │
                                    ┌──────▼──────┐
                                    │ Async Worker│
                                    │ (Consumer)  │
                                    └─────────────┘
              ┌──────────┐
              │Prometheus│ :9090 ──► Scrapes /metrics from Gateway
              └──────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **API Gateway** | FastAPI 0.115 / Uvicorn | Async Python ASGI server with OpenAPI auto-docs |
| **Database** | PostgreSQL 16 + SQLAlchemy 2.0 (async) | ACID-compliant persistence with row-level locking |
| **Migrations** | Alembic | Versioned schema migrations |
| **Cache** | Redis 7 | Balance snapshots, rate limiting, hot-path caching |
| **Message Broker** | RabbitMQ 3.13 | Event-driven transfer notifications, DLQ monitoring |
| **ML Pipeline** | Scikit-Learn + Pandas | RandomForest trained on 6.3M PaySim rows |
| **Frontend** | React 19 + Vite 8 + TailwindCSS | SPA with React Flow, Recharts, Sonner toast system |
| **Auth** | JWT (HS256) + bcrypt | Stateless authentication with role-based access control |
| **Monitoring** | Prometheus + Grafana 10.4 | Request-level metrics, latency histograms |
| **Reverse Proxy** | Nginx | Static frontend serving + API proxying |
| **Containerization** | Docker Compose (7 services) | Single-command deployment of the full stack |
| **PDF Engine** | ReportLab | Server-side account statement generation |

---

## Local Quickstart

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed
- Ports `80`, `3000`, `5432`, `5672`, `6379`, `8000`, `9090`, `15672` available

### 1. Clone and Configure

```bash
git clone https://github.com/sahil8017/SentinelClear.git
cd SentinelClear
cp .env.example .env
```

### 2. Build the Frontend Bundle

```bash
cd frontend
npm install
npm run build
cd ..
```

### 3. Launch the Full Stack

```bash
docker-compose up --build -d
```

This starts **7 containers**: PostgreSQL, Redis, RabbitMQ, FastAPI Gateway, Async Worker, Prometheus, Grafana, and Nginx.

### 4. Access the System

| Service | URL | Credentials |
|---------|-----|-------------|
| **SentinelClear UI** | [http://localhost](http://localhost) | Register a new account |
| **FastAPI Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive Swagger UI |
| **RabbitMQ Management** | [http://localhost:15672](http://localhost:15672) | `sentinel` / `sentinel_rabbit_2024` |
| **Grafana Dashboards** | [http://localhost:3000](http://localhost:3000) | `admin` / `admin` |
| **Prometheus** | [http://localhost:9090](http://localhost:9090) | — |

### 5. Seed an Admin Account

After registration, promote a user to admin for full Operations Hub access:

```bash
docker exec -it postgres-db psql -U sentinel -d sentinelclear \
  -c "UPDATE users SET role = 'ADMIN' WHERE username = 'your_username';"
```

> **Demo PIN:** All users are seeded with a default transaction PIN of `1234` for Step-Up Authentication testing. Change this in production.

---

## Project Structure

```
SentinelClear/
├── app/
│   ├── main.py                 # FastAPI application entry-point & lifespan
│   ├── config.py               # Centralised Pydantic settings
│   ├── database.py             # AsyncSession engine & session factory
│   ├── dependencies.py         # JWT auth, API key auth, admin guards
│   ├── models.py               # 15 SQLAlchemy ORM models
│   ├── schemas.py              # Pydantic request/response validation
│   ├── ml/                     # Trained model artifacts (.pkl)
│   ├── routers/
│   │   ├── transfers.py        # Core transfer engine + Step-Up + Maker-Checker
│   │   ├── auth.py             # Registration, login, PIN management
│   │   ├── accounts.py         # Account CRUD, deposits, directory
│   │   ├── audit.py            # EOD cryptographic chain verification
│   │   ├── chaos.py            # Chaos engineering + stress test endpoints
│   │   ├── fraud.py            # Rule config CRUD, dashboard analytics
│   │   ├── aml.py              # Network graph adjacency computation
│   │   ├── loans.py            # Credit origination & repayment
│   │   └── ...                 # Ledger, notifications, analytics, etc.
│   └── services/
│       ├── audit.py            # SHA-256 hash-chain append & verify
│       ├── fraud.py            # Hybrid scoring orchestrator
│       ├── fraud_rules.py      # 8 configurable heuristic rules
│       ├── fraud_service.py    # Transfer risk evaluation pipeline
│       ├── ml_service.py       # RandomForest inference + XAI extraction
│       ├── geo.py              # Haversine distance + IP-to-city mapping
│       ├── ledger.py           # Double-entry DEBIT/CREDIT creation
│       ├── str_generator.py    # Automated STR PDF generation
│       ├── reconciliation.py   # Balance-vs-ledger integrity checker
│       └── ...                 # Cache, rate limiting, webhooks, etc.
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── OpsDashboard.jsx    # Live incident stream + XAI widgets
│       │   ├── AMLGraph.jsx        # Interactive Money Mule network graph
│       │   ├── AuditLedger.jsx     # EOD cryptographic verification panel
│       │   ├── ChaosPanel.jsx      # Fault injection + stress testing
│       │   ├── MakerChecker.jsx    # Four Eyes approval queue
│       │   ├── Transfer.jsx        # Capital routing terminal
│       │   └── ...
│       └── components/
│           ├── AuthModal.jsx       # Step-Up PIN challenge modal
│           ├── Layout.jsx          # Role-based navigation shell
│           └── ...
├── worker/                     # RabbitMQ async consumer
├── monitoring/                 # Prometheus config + Grafana provisioning
├── nginx/                      # Reverse proxy config
├── alembic/                    # Database migration scripts
├── docker-compose.yml          # 7-service orchestration
├── Dockerfile                  # Python 3.12 slim API image
└── requirements.txt            # 20+ production dependencies
```

---

## API Surface (Selected Endpoints)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/firebase-login` | — | Zero-Trust Firebase Authentication |
| `POST` | `/auth/register` | — | Native User Registration |
| `POST` | `/auth/login` | — | Native JWT Token Issuance |
| `POST` | `/transfers` | Bearer | Execute atomic transfer through risk engine |
| `POST` | `/transfers/{id}/verify-auth` | Bearer | Complete Step-Up PIN challenge |
| `POST` | `/transfers/{id}/confirm-pause` | Bearer | Release a PAUSED transaction |
| `POST` | `/transfers/{id}/approve-guardian` | Bearer | Target trusted person approval |
| `GET` | `/audit/verify` | Admin | EOD cryptographic chain validation |
| `GET` | `/aml/network-graph` | Admin | Compute transfer adjacency graph |
| `POST` | `/loans/apply` | Bearer | Execute credit origination via ML inference |
| `POST` | `/admin/chaos/stress-test` | Admin | Fire 50 concurrent transfer assault |
| `GET` | `/fraud/dashboard` | Admin | Aggregate fraud analytics & tunable rules |
| `GET` | `/ledger/verify` | Bearer | Verify DEBIT/CREDIT balance equality |
| `GET` | `/accounts/me/statement` | Bearer | Generate PDF account statement |
| `GET` | `/health` | — | PostgreSQL + Redis + RabbitMQ health |
| `GET` | `/metrics` | — | Prometheus instrumentation |

> Full interactive documentation is available at `/docs` (Swagger UI) and `/redoc` (ReDoc) when the API Gateway is running.

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://...` | PostgreSQL connection string |
| `RABBITMQ_URL` | `amqp://...` | RabbitMQ connection string |
| `REDIS_URL` | `redis://redis:6379/0` | Redis connection string |
| `JWT_SECRET_KEY` | `sc-jwt-super-secret...` | **Change in production** |
| `FRAUD_BLOCK_THRESHOLD` | `0.7` | Risk score ≥ this → BLOCK |
| `FRAUD_REVIEW_THRESHOLD` | `0.4` | Risk score ≥ this → REVIEW |
| `MAKER_CHECKER_THRESHOLD` | `1000000` | Transfers above ₹10L require approval |
| `ENABLE_CHAOS_ENDPOINTS` | `true` | Toggle chaos engineering routes |

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with conviction.
</p>
