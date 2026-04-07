import React from 'react';

export default function AuditChain() {
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000 ease-out">
      <header className="space-y-4">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[0.95]">
          Audit <span className="text-indigo-600">Chain</span>.
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed max-w-2xl">
          SentinelClear implements a tamper-proof cryptographic audit trail. This ensures that every entry in the ledger is linkable to its predecessor, creating an immutable history of value movement.
        </p>
      </header>

      <hr className="border-zinc-100 dark:border-white/5" />

      {/* Chaining Logic Section */}
      <section className="space-y-8">
        <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white underline decoration-indigo-600/30 underline-offset-8">Cryptographic Chaining</h2>
        <p className="text-sm text-zinc-500 font-medium leading-relaxed">
          Inspired by blockchain-style primitives, each audit log entry contains a SHA-256 hash that incorporates the payload of the current transaction *and* the hash of the immediately preceding entry.
        </p>
        
        <div className="p-10 bg-zinc-900 dark:bg-black rounded-[40px] border border-white/5 relative group">
           <div className="absolute top-10 right-10 flex gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse delay-75"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 delay-150"></span>
           </div>
           <h4 className="text-[11px] font-black uppercase text-zinc-500 tracking-[0.2em] mb-4">Master Chaining Formula</h4>
           <div className="text-2xl font-mono text-white tracking-tighter leading-tight italic py-4">
              <span className="text-indigo-400">Hash(N)</span> = SHA256( <br />
              &nbsp;&nbsp;Data(N) + <span className="text-emerald-400">Hash(N-1)</span> <br />
              )
           </div>
        </div>
      </section>

      {/* Verification Section */}
      <section className="space-y-8">
        <h3 className="text-2xl font-black text-slate-900 dark:text-white underline decoration-indigo-600/30 underline-offset-8">The /audit/verify Command</h3>
        <p className="text-sm text-zinc-500 font-medium leading-relaxed">
          The Sentinel Forensic Scanner can be triggered at any time to walk the entire audit chain from the genesis block to the current state. If a single byte is modified in the historical record, the subsequent hashes will fail to validate.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center bg-zinc-50 dark:bg-white/[0.01] border border-zinc-200 dark:border-white/5 p-8 rounded-3xl">
           <div className="space-y-6">
              <div className="p-6 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-2xl">
                 <h4 className="font-bold text-sm mb-2">Detection Scenarios</h4>
                 <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                       <span className="material-symbols-outlined text-red-500 text-lg">dangerous</span>
                       <p className="text-xs text-zinc-500 font-medium">DB admin manually editing an amount in pure SQL.</p>
                    </li>
                    <li className="flex items-start gap-3">
                       <span className="material-symbols-outlined text-red-500 text-lg">dangerous</span>
                       <p className="text-xs text-zinc-500 font-medium">Injecting a fraudulent transaction in the middle of history.</p>
                    </li>
                    <li className="flex items-start gap-3">
                       <span className="material-symbols-outlined text-red-500 text-lg">dangerous</span>
                       <p className="text-xs text-zinc-500 font-medium">Deleting a critical rollback event to hide a dip.</p>
                    </li>
                 </ul>
              </div>
           </div>
           
           <div className="p-6 space-y-4">
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">Forensic Response</h4>
              <p className="text-sm text-zinc-500 font-medium leading-relaxed opacity-80">
                 Upon verification failure, the system emits a <code className="bg-red-500/10 text-red-500 px-1 rounded">CHAIN_CORRUPTION</code> exception, freezing all further mutations until manual reconciliation is completed by two authorized signatures.
              </p>
           </div>
        </div>
      </section>

      {/* Rule Notice */}
      <div className="p-8 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-3xl flex gap-8 items-center group shadow-2xl">
         <div className="space-y-2 flex-1">
            <h4 className="font-black text-[12px] uppercase tracking-[0.4em] mb-2 opacity-60 transition-opacity group-hover:opacity-100">Audit Rule #01</h4>
            <p className="text-2xl font-black leading-tight tracking-tight">
               "Hash Chain Integrity is Validated Before Every Payout Cycle."
            </p>
         </div>
         <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-2xl shadow-indigo-500/40 rotate-12 transition-all group-hover:rotate-0">
            <span className="material-symbols-outlined text-white text-3xl">history_edu</span>
         </div>
      </div>
    </div>
  );
}
