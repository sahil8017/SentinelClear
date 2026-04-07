import React from 'react';

export default function LedgerPrimitives() {
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000 ease-out">
      <header className="space-y-4">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[0.95]">
          Ledger <span className="text-indigo-600">Primitives</span>.
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed max-w-2xl">
          SentinelClear uses strict double-entry accounting at the database layer. Money acts like energy: it cannot be created or destroyed, only transferred between accounts within an atomic transaction.
        </p>
      </header>

      <hr className="border-zinc-100 dark:border-white/5" />

      {/* Double Entry Section */}
      <section className="space-y-6">
        <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Double-Entry Accounting</h2>
        <p className="text-sm text-zinc-500 font-medium leading-relaxed">
          Every transaction must generate exactly two entries: one <span className="font-bold text-red-500 dark:text-red-400 uppercase tracking-widest text-[10px]">Debit</span> and one <span className="font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-widest text-[10px]">Credit</span>. The sum of all debits and credits for a single transaction ID must equal zero.
        </p>
        
        <div className="p-8 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/5 rounded-3xl overflow-hidden relative">
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-600/30"></div>
          <h4 className="text-[11px] font-black uppercase text-zinc-400 dark:text-zinc-600 tracking-[0.2em] mb-4">Internal Ledger Payload</h4>
          <pre className="text-xs font-mono text-zinc-600 dark:text-zinc-400 leading-relaxed overflow-x-auto">
{`-- SQL Transaction Block
BEGIN;
  INSERT INTO entries (account_id, tx_id, type, amount) 
  VALUES ('acc_sender', 'tx_unique_01', 'DEBIT', -500.00);

  INSERT INTO entries (account_id, tx_id, type, amount) 
  VALUES ('acc_receiver', 'tx_unique_01', 'CREDIT', 500.00);
  
  -- The invariant: SUM(entries.amount) WHERE tx_id = 'tx_unique_01' MUST BE 0.00
COMMIT;`}
          </pre>
        </div>
      </section>

      {/* Row-Level Locking Section */}
      <section className="space-y-8">
        <h3 className="text-2xl font-black text-slate-900 dark:text-white underline decoration-indigo-600/30 underline-offset-8">Deterministic Locking</h3>
        <p className="text-sm text-zinc-500 font-medium leading-relaxed">
          To prevent database deadlocks in high-concurrency environments, SentinelClear follows the <span className="font-bold text-indigo-600 dark:text-indigo-400 tracking-tight">Ascending UUID Protocol</span>. When selecting rows for update, SQL locks must always be acquired in the natural sorted order of the UUID strings.
        </p>
        
        <div className="p-8 bg-indigo-600/5 border border-indigo-600/20 rounded-3xl">
           <h4 className="text-[11px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-[0.2em] mb-4">Deadlock Elimination Formula</h4>
           <div className="space-y-4">
              <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                 "If Account-A (id: <code className="text-xs">001...</code>) and Account-B (id: <code className="text-xs">999...</code>) are in a transfer, the worker MUST lock Account-A before Account-B."
              </p>
              <p className="text-xs text-zinc-500 font-medium opacity-70">
                 Failure to follow this order on concurrent bi-directional transfers will cause cyclic dependency deadlocks. SentinelClear mathematically prevents this.
              </p>
           </div>
        </div>
      </section>

      {/* Zero-Sum Balance Section */}
      <section className="space-y-6">
        <h3 className="text-xl font-black text-slate-900 dark:text-white">The Zero-Sum Guard</h3>
        <p className="text-sm text-zinc-500 font-medium leading-relaxed">
          The balance of an account is never stored as a single mutable field in the main accounts table. Instead, it is dynamically computed from an append-only ledger history or retrieved from a <span className="text-indigo-600 dark:text-indigo-400 font-bold">Snapshot Log</span>. This prevents race conditions where the balance could be updated incorrectly.
        </p>
      </section>

      {/* Rule Notice */}
      <div className="p-8 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-3xl flex flex-col md:flex-row items-center justify-between gap-8 group">
         <div className="space-y-2 flex-1">
            <h4 className="font-black text-sm uppercase tracking-[0.3em] opacity-70 transition-opacity group-hover:opacity-100">Implementation Rule #02</h4>
            <p className="text-xl font-bold leading-tight">
               "No Ledger entry can be modified or deleted. To reverse a mistake, a new Compensating Transaction must be recorded."
            </p>
         </div>
         <span className="material-symbols-outlined text-6xl opacity-20 transition-all group-hover:rotate-180 group-hover:opacity-100 hidden md:block">rotate_left</span>
      </div>
    </div>
  );
}
