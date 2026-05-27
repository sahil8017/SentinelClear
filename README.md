---
title: SentinelClear API
emoji: 🛡️
colorFrom: blue
colorTo: purple
sdk: docker
pinned: false
app_port: 7860
---

<div align="center">

# SentinelClear

### Real-Time Transaction Protection & Account-Drain Prevention

![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Neo4j](https://img.shields.io/badge/Neo4j-5-4581C3?style=flat-square&logo=neo4j&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis&logoColor=white)
![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3.13-FF6600?style=flat-square&logo=rabbitmq&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)
![Build](https://img.shields.io/github/actions/workflow/status/sahil8017/SentinelClear/ci.yml?branch=main&style=flat-square&logo=github-actions&logoColor=white&label=CI/CD)

SentinelClear is a full-stack banking protection system that monitors every outgoing transfer in real time, flags anomalous patterns before money leaves the account, and gives users instant control over their funds through an emergency kill switch, guardian approvals, and automated credit scoring — all backed by an immutable double-entry ledger.

---

</div>

## How It Works

A user signs up and immediately receives an automated sandbox test balance. From that point, every transfer they make passes through a layered risk engine that scores the transaction against five tunable detection rules. High-risk transfers are blocked or held for review. Administrators monitor incidents via a live WebSocket feed and can adjust risk parameters without redeploying. The system also provides automated credit scoring and loan underwriting — no manual financial data entry required.

---

Test balances are automatically provisioned upon registration so users can execute sandbox transactions immediately.

---

## Unified Risk Engine

All fraud detection parameters and banking limits live in a single **System Configuration** panel on the Operations Matrix dashboard. Administrators tune each rule using a **0×–3× weight slider** that controls how much that rule contributes to the composite risk score of a transaction.

### Detection Rules

| Rule | Default Weight | Threshold | What It Does |
| :--- | :---: | :---: | :--- |
| **Amount Threshold** | 1.0× | ₹50,000 | Flags transfers that are uncharacteristically large relative to account history |
| **Burst Velocity** | 2.0× | 10 txns | Detects rapid, machine-like transfer bursts — stops automated script attacks |
| **New Account Penalty** | 1.3× | ₹10,000 | Applies extra risk to newly registered accounts making early large transfers |
| **Time of Day (Midnight Guard)** | 0.8× | 1 AM–5 AM | Multiplies risk for transactions executed during high-risk sleeping hours |
| **Velocity Spike** | 1.5× | — | Monitors abnormal activity spikes compared to the user's historical baseline |

A transaction's composite score is computed from all enabled rules. If it crosses **0.4**, the transfer is held for review. If it crosses **0.8**, it is blocked outright. Both thresholds are configurable. Every parameter change is logged to an immutable admin changelog with timestamps and the operator's identity.

### Banking Limits (System Settings)

These are separate hard caps enforced alongside the heuristic rules:
- **Maker-Checker Threshold** — Transfers above this amount require independent admin approval (Four Eyes Principle)
- **Daily Velocity Limit** — Maximum number of transfers per account per day
- **Vulnerable Age Threshold** — Age cutoff (default 70) for guardian-approval requirements

---

## Automated Credit Hub

The Credit Hub computes a CIBIL-parity credit score (300–900) without requiring the user to manually enter income, assets, or employment data.

### How It Works

1. The user submits a 3-field identity payload: **PAN Number**, **Mobile/Email**, and **Transaction PIN**.
2. The backend uses the authenticated user's session to pull their actual financial state:
   - **Occupation tier** → base income, assets, and liability estimates
   - **Ledger transaction history** → total credits received, adjusted monthly income
   - **Account balances** → total asset calculation
   - **Active loans** → real-time liability computation
   - **Past loan performance** → repayment score and default count
3. These inputs feed into the ML scoring function, which outputs a credit score, FOIR, DTI, and risk category.
4. A **₹35.00 bureau query fee** is noted as deducted from the pre-seeded balance per pull.

The computed profile is saved to the database. Subsequent fetches return the cached profile and recalculate if the user's financial state has changed. Loan eligibility checks and applications use the same dynamic profile — the system auto-creates one if it doesn't exist.

---

## UPI Safety Controls

Three protective mechanisms that give users direct control over their funds:

- **Non-Whitelisted Pause** — Transfers above ₹10,000 to accounts not on the user's whitelist are held for a cooling-off period before execution.
- **Guardian Protection** — Users aged ≥70 or with accessibility needs can designate a trusted person. Transfers above ₹50,000 require the guardian's approval.
- **Emergency Kill Switch** — A single-tap panic button that instantly freezes all outgoing payments. No PIN required to activate. PIN required to deactivate (prevents an attacker from re-enabling payments on a compromised device).

---

## AML Graph Analytics

Transaction relationships are mirrored into Neo4j as a directed graph. The system runs Cypher traversal queries to detect:
- **Circular money flows** — Chains like A → B → C → A up to depth 6
- **Coordinated fraud rings** — Connected-component analysis across clustered accounts

The frontend renders this graph interactively, with accounts as nodes and transfers as risk-weighted edges.

---

## Technical Stack

### Backend

| Component | Technology |
| :--- | :--- |
| API Gateway | FastAPI 0.115, Uvicorn ASGI |
| Primary Database | PostgreSQL 16, Alembic migrations |
| Graph Engine | Neo4j 5 |
| Cache & Rate Limiting | Redis 7 |
| Event Bus | RabbitMQ 3.13 |
| ML Runtime | Scikit-learn, Pandas |

### Frontend

| Component | Technology |
| :--- | :--- |
| Framework | React 18, Vite |
| Styling | Vanilla CSS, Stripe-inspired design system |
| Visualizations | Recharts (telemetry), React Flow (graph) |

### Deployment

| Target | Provider |
| :--- | :--- |
| Application | Docker multi-stage → Hugging Face Spaces (port 7860) |
| Database | Neon Serverless PostgreSQL |
| Graph DB | Neo4j Aura |
| Redis | Upstash Serverless |
| Message Queue | CloudAMQP |

---

## Local Setup

```bash
git clone https://github.com/sahil8017/SentinelClear.git
cd SentinelClear
cp .env.example .env
docker compose up -d --build
docker compose exec api-gateway python scripts/seed_data.py
```

### Access Points

| Resource | URL |
| :--- | :--- |
| Frontend | `http://localhost` |
| API Docs (Swagger) | `http://localhost:8000/docs` |
| Neo4j Browser | `http://localhost:7474` |
| RabbitMQ Console | `http://localhost:15672` |

After the stack is running, open the frontend and register a new account. Your sandbox balance will be instantly provisioned so you can execute transfers immediately.

---

## Project Structure

```
SentinelClear/
├── app/
│   ├── main.py                # FastAPI entry point, startup hooks, admin seeding
│   ├── config.py              # Environment-driven settings (fraud thresholds, JWT, DB)
│   ├── models.py              # SQLAlchemy ORM — 15+ tables (users, accounts, transfers, credit profiles)
│   ├── schemas.py             # Pydantic request/response validation
│   ├── dependencies.py        # JWT auth, role guards, admin checks
│   ├── routers/
│   │   ├── auth.py            # Registration, login, profile setup, balance provisioning
│   │   ├── accounts.py        # Account CRUD, balance lookups, kill switch, annual limits
│   │   ├── transfers.py       # Transfer execution, fraud scoring, maker-checker holds
│   │   ├── loans.py           # Credit profiles, eligibility checks, loan lifecycle
│   │   └── aml.py             # Neo4j graph queries, STR generation, fraud dashboards
│   └── services/
│       ├── transfer_service.py   # Double-entry ledger, row-level locking, deadlock prevention
│       ├── fraud_service.py      # Composite risk scoring across all detection rules
│       ├── safety_service.py     # UPI safety checks (whitelist, guardian, kill switch)
│       ├── ml_loan_service.py    # Credit score computation, loan eligibility ML
│       └── audit_service.py      # Hash-chain audit trail, reconciliation engine
├── frontend/src/
│   ├── pages/
│   │   ├── Dashboard.jsx         # Account overview, balance, recent activity
│   │   ├── Transfer.jsx          # Send money, beneficiary management
│   │   ├── CreditHub.jsx         # Credit score fetch, loan eligibility, loan management
│   │   ├── AMLGraph.jsx          # Neo4j graph visualization
│   │   ├── OpsDashboard.jsx      # Admin: risk engine tuning, live alerts, loan approvals
│   │   ├── UPISafety.jsx         # Kill switch, whitelist, guardian settings
│   │   └── FraudAnalytics.jsx    # Risk distribution charts, flagged transfer history
│   └── lib/
│       └── axios.js              # API client with JWT interceptor
├── worker/                    # RabbitMQ consumer — notifications, graph sync
├── monitoring/                # Prometheus, OpenTelemetry, Grafana Tempo configs
├── nginx/                     # Reverse proxy routing
├── scripts/                   # Database seeding (Treasury account bootstrap)
├── tests/                     # Integration test suite
├── alembic/                   # Database migration versions
├── docker-compose.yml         # Local development stack
└── Dockerfile                 # Multi-stage production build
```

---

## CI/CD

The pipeline in `.github/workflows/ci.yml` runs on every push:

1. **Lint & Type Check** — `ruff check` and `mypy`
2. **Security Scan** — `bandit` (Python) and `trivy` (container image)
3. **Integration Tests** — Boots the full Docker stack and runs `tests/test_everything.py`
4. **Container Build** — Multi-stage Docker image pushed to GitHub Container Registry

---

## License

MIT — see [LICENSE](LICENSE).
