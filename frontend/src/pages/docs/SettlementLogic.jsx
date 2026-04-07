import React from 'react';

export default function SettlementLogic() {
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000 ease-out">
      <header className="space-y-4">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[0.95]">
          Settlement <span className="text-indigo-600">Logic</span>.
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed max-w-2xl">
          SentinelClear differentiates between <span className="text-indigo-600 dark:text-indigo-400 font-bold italic">Transaction Authorization</span> and <span className="text-indigo-600 dark:text-indigo-400 font-bold italic">Final Settlement</span>. This two-phase commit ensures that high-volume processing doesn't degrade ledger integrity.
        </p>
      </header>

      <hr className="border-zinc-100 dark:border-white/5" />

      {/* Concurrent Settlement Section */}
      <section className="space-y-8 p-10 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/5 rounded-3xl overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 blur-3xl opacity-0 transition-opacity group-hover:opacity-100 duration-500"></div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Concurrent Clearing Models</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-widest px-2 py-1 bg-indigo-600/10 rounded w-fit italic">Immediate Settler</h4>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed">
              Standard for retail-tier accounts. The `SELECT FOR UPDATE` lock is held for the duration of the fraud check and ledger write. This guarantees that funds exist at the exact millisecond of authorization.
            </p>
          </div>
          <div className="space-y-4">
             <h4 className="text-[10px] font-black uppercase text-amber-600 tracking-widest px-2 py-1 bg-amber-600/10 rounded w-fit italic">Delayed Clearing</h4>
             <p className="text-sm text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed">
               Used for bulk enterprise transfers. Authorization is based on a <span className="text-indigo-500 font-black tracking-tight underline underline-offset-2">Redis Reservation</span>. The physical database commit occurs in an asynchronous worker thread via RabbitMQ.
             </p>
          </div>
        </div>
      </section>

      {/* Reconciliation Section */}
      <section className="space-y-8">
        <h3 className="text-3xl font-black text-slate-900 dark:text-white underline decoration-indigo-600/30 underline-offset-8">Background Reconciliation</h3>
        <p className="text-sm text-zinc-500 font-medium leading-relaxed">
          Every 24 hours, the Sentinel Reconciliation Engine performs a "Zero-Check" on every account. It recalculates the account's total balance from the append-only entry log and compares it against the cached snapshot.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
           <div className="p-8 bg-zinc-900 dark:bg-black rounded-3xl border border-white/10 relative overflow-hidden group">
              <span className="material-symbols-outlined absolute -top-4 -right-4 text-9xl text-white opacity-5 transition-transform group-hover:scale-125 duration-1000">sync_alt</span>
              <h4 className="text-[11px] font-black uppercase text-zinc-500 tracking-[0.2em] mb-4">Recon Invariant Formula</h4>
              <div className="text-xl font-mono text-zinc-400 dark:text-zinc-500 italic space-y-4">
                 <p>ΔBalance = Σ(Credits) - Σ(Debits)</p>
                 <hr className="border-white/10" />
                 <p className="text-indigo-400 font-black">IF (Snap_Prev + ΔBalance) != Snap_Current: TRIGGER_AUDIT_ALARM()</p>
              </div>
           </div>
           
           <div className="space-y-4">
              <h4 className="font-bold text-lg text-slate-900 dark:text-white">The Sentinel Drift Detector</h4>
              <p className="text-sm text-zinc-500 font-medium leading-relaxed opacity-80">
                 If even a 1-cent discrepancy is detected between logs and snapshots, that ledger segment is instantly frozen, and a forensic deep-scan is initiated. SentinelClear avoids "Estimated Balances" at all costs.
              </p>
           </div>
        </div>
      </section>

      {/* Rule Notice */}
      <div className="p-8 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-3xl flex gap-8 items-center group">
         <div className="space-y-2 flex-1">
            <h4 className="font-black text-[12px] uppercase tracking-[0.4em] mb-2 opacity-60">System Rule #42</h4>
            <p className="text-2xl font-black leading-tight tracking-tight">
               "Settlement is Final. No Rollback After Snapshot." 
            </p>
         </div>
         <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-2xl shadow-indigo-500/40 opacity-40 transition-all group-hover:opacity-100 group-hover:scale-110">
            <span className="material-symbols-outlined text-white text-3xl">verified</span>
         </div>
      </div>

    </div>
  );
}
