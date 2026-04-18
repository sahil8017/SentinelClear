import React from 'react';

export default function Introduction() {
  return (
    <>
      <div className="mb-2 text-[11px] font-semibold tracking-wider text-blue-600 dark:text-indigo-400 uppercase">
        Overview
      </div>
      <h1 className="leading-tight">What is SentinelClear?</h1>
      
      <p className="text-xl">
        SentinelClear is a high-performance, centralized ledger designed to securely settle digital transactions, prevent fraud using configurable heuristic rules, and underwrite dynamic loans — all built on a zero-trust, rule-based security architecture.
      </p>

      <p>
        If you are a non-technical stakeholder, think of SentinelClear as a highly secure digital vault. It does exactly three things perfectly:
      </p>
      <ul>
        <li><strong>Money Movement:</strong> It moves money between users securely. Money is never "lost in transit" — enforced through double-entry accounting with atomic finality.</li>
        <li><strong>Rule-Based Security Guard:</strong> Every single transfer is evaluated in sub-50ms by a configurable rule engine covering velocity limits, geographic anomalies, and behavioral heuristics.</li>
        <li><strong>Lending:</strong> It underwrites and disburses loans to eligible users through an admin-approved pipeline with full audit trails.</li>
      </ul>

      <p>
        If you are a developer, SentinelClear is a heavily transactional, idempotent, event-driven accounting architecture built on <strong>FastAPI, PostgreSQL, Redis, and RabbitMQ</strong> with real-time WebSocket alerts, PDF statement generation, and a maker-checker compliance framework.
      </p>

      <h2>Core Concepts</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-8">
        <div className="p-5 border border-zinc-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-[#0c0c0d]">
          <h3 className="!mt-0 !mb-2 !text-base">Double-Entry Ledger</h3>
          <p className="!text-sm !my-0">
            For every debit, there must be a matching credit. SentinelClear strictly enforces double-entry rules using Postgres ACID transactions, ensuring money is never created or destroyed.
          </p>
        </div>
        <div className="p-5 border border-zinc-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-[#0c0c0d]">
          <h3 className="!mt-0 !mb-2 !text-base">Idempotency</h3>
          <p className="!text-sm !my-0">
            Network failed? Try again. Our Redis-backed idempotency keys ensure nobody gets charged twice for the same operation. Keys are cached for 24 hours.
          </p>
        </div>
        <div className="p-5 border border-zinc-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-[#0c0c0d]">
          <h3 className="!mt-0 !mb-2 !text-base">Heuristic Risk Engine</h3>
          <p className="!text-sm !my-0">
            Incoming transactions are evaluated against configurable rule thresholds — burst velocity, amount limits, geographic anomalies, and new-account restrictions — all tunable from the Operations Dashboard.
          </p>
        </div>
        <div className="p-5 border border-zinc-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-[#0c0c0d]">
          <h3 className="!mt-0 !mb-2 !text-base">UPI Safety Framework</h3>
          <p className="!text-sm !my-0">
            Emergency kill switch, annual receiving limits, transaction pause for suspicious amounts, and whitelisted contacts — built-in protections inspired by Indian UPI safety guidelines.
          </p>
        </div>
      </div>

      <h2>System Architecture</h2>
      <p>
        SentinelClear is composed of the following production-grade services:
      </p>
      <ul>
        <li><strong>API Gateway</strong> (FastAPI + Uvicorn) — All REST endpoints, WebSocket alerts, and business logic</li>
        <li><strong>PostgreSQL 16</strong> — Primary ACID-compliant data store with audit hash chains</li>
        <li><strong>Redis 7</strong> — Idempotency key caching, rate limiting, and session management</li>
        <li><strong>RabbitMQ 3.13</strong> — Async event publishing for webhook dispatches and worker tasks</li>
        <li><strong>Async Worker</strong> — Background consumer for webhook deliveries and notifications</li>
        <li><strong>Nginx</strong> — Reverse proxy serving the production frontend build</li>
        <li><strong>Prometheus + Grafana</strong> — Metrics collection and observability dashboards</li>
      </ul>
    </>
  );
}
