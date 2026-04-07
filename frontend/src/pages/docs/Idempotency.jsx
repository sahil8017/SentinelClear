import React from 'react';

export default function Idempotency() {
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000 ease-out">
      <header className="space-y-4">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[0.95]">
          <span className="text-indigo-600">Idempotency</span> Logic.
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed max-w-2xl">
          SentinelClear enforces strict idempotency for all mutation requests to prevent the accidental double-charging of accounts during network retries or client failures.
        </p>
      </header>

      <hr className="border-zinc-100 dark:border-white/5" />

      {/* The Key Concept */}
      <section className="space-y-6">
        <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white underline decoration-indigo-600/30 underline-offset-8 decoration-4">The Atomicity Barrier</h2>
        <p className="text-sm text-zinc-500 font-medium leading-relaxed">
          Every POST request that modifies the ledger state must include a client-generated <code className="font-bold text-indigo-600 dark:text-indigo-400">Idempotency-Key</code>. This key acts as a unique fingerprint for the operation. If the system receives a second request with the same key, it returns the cached result of the original operation instead of executing the processing pipeline again.
        </p>
      </section>

      {/* Workflow Diagram Logic */}
      <section className="space-y-8 p-10 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/5 rounded-3xl">
         <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">How it Works (Internal Flow)</h3>
         <div className="space-y-6">
            <div className="flex items-start gap-4">
               <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-black shrink-0 shadow-lg shadow-indigo-500/20">1</div>
               <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 leading-relaxed pt-1">Client generates a <code className="text-xs px-2 py-0.5 bg-indigo-50 dark:bg-white/5 rounded">UUIDv4</code> and attaches it to the request header.</p>
            </div>
            <div className="flex items-start gap-4">
               <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-black shrink-0 shadow-lg shadow-indigo-500/20">2</div>
               <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 leading-relaxed pt-1">FastAPI Middleware checks the key against <span className="font-black text-indigo-600 dark:text-indigo-400">Redis 7</span> cache.</p>
            </div>
            <div className="flex items-start gap-4 pl-12 border-l-2 border-indigo-600/10">
               <span className="material-symbols-outlined text-indigo-500">subdirectory_arrow_right</span>
               <p className="text-xs font-bold text-zinc-500 leading-relaxed">If Found: Immediate 200 OK with cached response body metadata.</p>
            </div>
            <div className="flex items-start gap-4 pl-12 border-l-2 border-indigo-600/10">
               <span className="material-symbols-outlined text-indigo-500">subdirectory_arrow_right</span>
               <p className="text-xs font-bold text-zinc-500 leading-relaxed">If Not Found: Transaction locks the key in Redis (Atomic <code className="text-xs px-2 py-0.5 bg-indigo-50 dark:bg-white/5 rounded">SETNX</code>) and proceeds to ledger commitment.</p>
            </div>
            <div className="flex items-start gap-4">
               <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-black shrink-0 shadow-lg shadow-indigo-500/20">3</div>
               <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 leading-relaxed pt-1">On Success, the result is stored in Redis for 24 hours.</p>
            </div>
         </div>
      </section>

      {/* Code Block Example */}
      <section className="space-y-6">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Example Request Configuration</h3>
        <div className="p-6 bg-zinc-900 dark:bg-black rounded-3xl border border-white/5">
           <pre className="text-xs font-mono text-indigo-400 leading-relaxed overflow-x-auto">
{`curl -X POST https://api.sentinelclear.io/v3/transfers \\
  -H "Authorization: Bearer <TOKEN>" \\
  -H "Idempotency-Key: e98b2f91-5a9e-4c3d-b6a1-987d6e4f3a2c" \\
  -d '{
    "sender_id": "acc_001",
    "receiver_id": "acc_002",
    "amount": 500.00
  }'`}
           </pre>
        </div>
      </section>

      {/* Rules Notice */}
      <div className="p-8 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-3xl flex items-center justify-between gap-8">
         <div className="space-y-2">
            <h4 className="font-black text-sm uppercase tracking-[0.3em] opacity-70">Implementation Rule #09</h4>
            <p className="text-xl font-bold leading-tight">
               "Idempotency keys are case-sensitive. SentinelClear treats 'Key-A' and 'key-a' as separate transactions."
            </p>
         </div>
         <div className="hidden md:flex w-24 h-24 bg-indigo-500 rounded-2xl rotate-12 flex items-center justify-center shadow-2xl shadow-indigo-500/40">
            <span className="material-symbols-outlined text-4xl text-white -rotate-12">repeat_one</span>
         </div>
      </div>
    </div>
  );
}
