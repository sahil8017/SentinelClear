import React from 'react';

export default function LedgerArchitecture() {
  return (
    <>
      <div className="mb-2 text-[11px] font-semibold tracking-wider text-blue-600 dark:text-indigo-400 uppercase">
        Core Platform
      </div>
      <h1 className="leading-tight">Ledger Architecture</h1>
      
      <p>
        SentinelClear implements a production-grade double-entry accounting system built on PostgreSQL ACID transactions with row-level locking. Every transfer creates two matching ledger entries (DEBIT and CREDIT), ensuring money is never created or destroyed.
      </p>

      <h2>How a Transfer Works (Step by Step)</h2>
      <p>
        When a user initiates a transfer via <code>POST /api/transfers</code>, the following processing pipeline executes atomically:
      </p>

      <ol>
        <li><strong>Idempotency Check:</strong> If an <code>Idempotency-Key</code> header is provided, the system checks Redis for a cached result. If found, the original response is returned without re-executing. Keys are cached for 24 hours.</li>
        <li><strong>UPI Safety Enforcement:</strong> The kill switch, annual receiving limit, and transaction pause thresholds are validated before any business logic runs.</li>
        <li><strong>Risk Engine Scoring:</strong> The fraud service evaluates the transaction against regulatory limits (Layer 1) and heuristic rules (Layer 2). If the composite risk score exceeds <code>0.70</code>, the transfer is blocked.</li>
        <li><strong>Row-Level Locking:</strong> Both sender and receiver accounts are locked with <code>SELECT ... FOR UPDATE</code> in a consistent order (sorted by account ID) to prevent deadlocks.</li>
        <li><strong>Balance Mutation:</strong> Sender balance is decremented and receiver balance is incremented within the same database transaction.</li>
        <li><strong>Ledger Entry Creation:</strong> Two <code>LedgerEntry</code> rows are inserted — a DEBIT for the sender and a CREDIT for the receiver — both linked to the same <code>transfer_id</code>.</li>
        <li><strong>Audit Hash Chaining:</strong> An <code>AuditEntry</code> is created with a SHA-256 hash chaining to the previous entry, forming a tamper-evident log.</li>
        <li><strong>Async Event Publishing:</strong> A RabbitMQ message is published for downstream consumers (webhooks, notifications).</li>
      </ol>

      <h2>Double-Entry Accounting</h2>
      <p>
        For every transfer, two ledger rows are created:
      </p>

      <pre><code>{`-- For a ₹1,000 transfer from Account A to Account B:

INSERT INTO ledger_entries (transfer_id, account_id, entry_type, amount)
VALUES ('tx_123', 'account_A', 'DEBIT',  1000.00);

INSERT INTO ledger_entries (transfer_id, account_id, entry_type, amount)
VALUES ('tx_123', 'account_B', 'CREDIT', 1000.00);

-- Invariant: SUM(credits) - SUM(debits) = 0 (always)`}</code></pre>

      <p>
        This invariant is verifiable at any time via the <code>GET /api/ledger/verify/integrity</code> endpoint, which walks the entire ledger and confirms that total debits equal total credits.
      </p>

      <h2>Row-Level Locking & Deadlock Prevention</h2>
      <p>
        To prevent race conditions in concurrent transfers, SentinelClear uses PostgreSQL's <code>SELECT ... FOR UPDATE</code> with a consistent lock ordering strategy. Account IDs are sorted before locking, ensuring two concurrent transfers between the same accounts always acquire locks in the same order.
      </p>

      <pre><code>{`# Lock ordering to prevent deadlocks
ordered_ids = sorted([sender_account_id, receiver_account_id])
for acct_id in ordered_ids:
    await db.execute(
        select(Account)
        .where(Account.id == acct_id)
        .with_for_update()
    )`}</code></pre>

      <h2>Idempotency</h2>
      <p>
        Network failures can cause clients to retry transfer requests. Without idempotency, this could result in double charges. SentinelClear solves this with Redis-backed idempotency keys:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
        <div className="p-4 border border-zinc-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-[#0c0c0d]">
          <h4 className="!mt-0 !mb-2 !text-sm font-bold">First Request</h4>
          <p className="!text-sm !my-0">
            Transfer executes normally. The result (status code + response body) is cached in Redis with the idempotency key as the cache key. TTL: 24 hours.
          </p>
        </div>
        <div className="p-4 border border-zinc-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-[#0c0c0d]">
          <h4 className="!mt-0 !mb-2 !text-sm font-bold">Retry Request</h4>
          <p className="!text-sm !my-0">
            The cached response is returned immediately. No database mutations occur. The user sees the exact same response as the original.
          </p>
        </div>
      </div>

      <h2>Audit Hash Chaining</h2>
      <p>
        Every completed transfer generates an audit entry whose <code>hash</code> is computed as:
      </p>

      <pre><code>{`hash = SHA-256(previous_hash + event_type + payload_json + timestamp)`}</code></pre>

      <p>
        This creates an append-only chain. If anyone manually modifies a row in PostgreSQL, the hash chain breaks and the integrity check reports the exact entry where tampering occurred. The <code>GET /api/audit/verify</code> endpoint walks this chain and reports:
      </p>
      <ul>
        <li><code>intact: true/false</code> — Whether all hashes are valid</li>
        <li><code>total_entries</code> — Number of audit entries checked</li>
        <li><code>first_tampered_at</code> — Index of the first broken link (if any)</li>
      </ul>

      <h2>Balance Snapshots</h2>
      <p>
        After every transfer, a <code>BalanceSnapshot</code> row is upserted for both sender and receiver accounts. This provides O(1) balance reads without scanning the ledger. The snapshot is always derived from the actual balance column and serves as a cache layer for the dashboard.
      </p>
    </>
  );
}
