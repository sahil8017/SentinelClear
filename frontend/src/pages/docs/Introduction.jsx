import React from 'react';

export default function Introduction() {
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000 ease-out">
      {/* Hero Section */}
      <header className="space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em]">
           System Manifest v3.0
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tightest text-slate-900 dark:text-white leading-[0.95]">
          The Digital <span className="text-indigo-600">Vault</span>.
        </h1>
        <p className="text-xl text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed max-w-2xl">
          SentinelClear is a production-grade, zero-leakage financial settlement engine. It treats transactions not as simple CRUD operations, but as immutable cryptographic events governed by strict double-entry ledger primitives.
        </p>
      </header>

      <hr className="border-zinc-100 dark:border-white/5" />

      {/* Philosophy Section */}
      <section className="space-y-8">
        <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Core Philosophy</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-6 bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 rounded-3xl">
            <h3 className="font-bold text-lg mb-3">Absolute Finality</h3>
            <p className="text-sm text-zinc-500 font-medium leading-relaxed">
              Every operation in SentinelClear is either 100% committed with a tamper-proof hash chain or safely rolled back via ACID-compliant PostgreSQL transactions. Capital integrity is the non-negotiable invariant.
            </p>
          </div>
          <div className="p-6 bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 rounded-3xl">
            <h3 className="font-bold text-lg mb-3">Event-Driven Integrity</h3>
            <p className="text-sm text-zinc-500 font-medium leading-relaxed">
              Shifting away from state-update CRUD patterns, we leverage an event-driven architecture using RabbitMQ. This ensures that every movement of value is recorded as a discrete event before it is reflected in the ledger.
            </p>
          </div>
        </div>
      </section>

      {/* Tech Stack Table */}
      <section className="space-y-8">
        <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">The Sentinel Stack</h2>
        <div className="overflow-hidden border border-zinc-200 dark:border-white/5 rounded-3xl bg-white dark:bg-transparent shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead className="bg-zinc-50 dark:bg-white/[0.02]">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 border-b border-zinc-200 dark:border-white/5">Layer</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 border-b border-zinc-200 dark:border-white/5">Technology</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 border-b border-zinc-200 dark:border-white/5">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
              <tr>
                <td className="px-6 py-5 font-bold text-sm">Backend Engine</td>
                <td className="px-6 py-5 font-mono text-xs text-indigo-600 dark:text-indigo-400">FastAPI (Python 3.12+)</td>
                <td className="px-6 py-5 text-sm text-zinc-500 font-medium">Asynchronous request handling and Pydantic-based validation.</td>
              </tr>
              <tr>
                <td className="px-6 py-5 font-bold text-sm">Persistence</td>
                <td className="px-6 py-5 font-mono text-xs text-indigo-600 dark:text-indigo-400">PostgreSQL 16</td>
                <td className="px-6 py-5 text-sm text-zinc-500 font-medium">Atomic ledger storage with strict SQL constraints and Row Level Security.</td>
              </tr>
              <tr>
                <td className="px-6 py-5 font-bold text-sm">Idempotency & Cache</td>
                <td className="px-6 py-5 font-mono text-xs text-indigo-600 dark:text-indigo-400">Redis 7</td>
                <td className="px-6 py-5 text-sm text-zinc-500 font-medium">Distributed locking and Idempotency key storage (24h TTL).</td>
              </tr>
              <tr>
                <td className="px-6 py-5 font-bold text-sm">Messaging</td>
                <td className="px-6 py-5 font-mono text-xs text-indigo-600 dark:text-indigo-400">RabbitMQ</td>
                <td className="px-6 py-5 text-sm text-zinc-500 font-medium">Fault-tolerant event bus with Dead Letter Queue (DLQ) support.</td>
              </tr>
              <tr>
                <td className="px-6 py-5 font-bold text-sm">Frontend Terminal</td>
                <td className="px-6 py-5 font-mono text-xs text-indigo-600 dark:text-indigo-400">React (Vite) + Tailwind</td>
                <td className="px-6 py-5 text-sm text-zinc-500 font-medium">High-performance SaaS UI built for real-time observability.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Warning Box */}
      <div className="p-8 bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-3xl flex gap-6">
         <span className="material-symbols-outlined text-amber-500 text-3xl shrink-0">warning_amber</span>
         <div className="space-y-2">
            <h4 className="font-bold text-amber-900 dark:text-amber-400">Zero-Tolerance for Data Loss</h4>
            <p className="text-sm text-amber-800 dark:text-amber-500/80 font-medium leading-relaxed">
               SentinelClear is designed for high-stakes financial environments. Every software update must pass the 100% Atomic Commit test. If any component in the chain (Redis, RabbitMQ, or DB) fails, the system enters a "Fail-Safe State" rather than risk a partial ledger entry.
            </p>
         </div>
      </div>
    </div>
  );
}
