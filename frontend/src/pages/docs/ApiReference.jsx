import React from 'react';

export default function ApiReference() {
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000 ease-out">
      <header className="space-y-4">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[0.95]">
          API <span className="text-indigo-600">Reference</span>.
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed max-w-2xl">
          The SentinelClear API is a high-performance RESTful interface designed for sub-millisecond transaction processing and absolute state consistency.
        </p>
      </header>

      <hr className="border-zinc-100 dark:border-white/5" />

      {/* Global Headers */}
      <section className="space-y-6">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white underline decoration-indigo-600/30 underline-offset-8">Global Headers</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div className="p-5 border border-zinc-200 dark:border-white/5 rounded-2xl">
              <code className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Authorization</code>
              <p className="text-xs text-zinc-500 font-medium mt-2 leading-relaxed">Required for all mutation requests. Bearer token format: <code className="bg-zinc-100 dark:bg-white/5 px-1 rounded">Bearer &lt;token&gt;</code></p>
           </div>
           <div className="p-5 border border-zinc-200 dark:border-white/5 rounded-2xl">
              <code className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Idempotency-Key</code>
              <p className="text-xs text-zinc-500 font-medium mt-2 leading-relaxed">MUST be a unique UUIDv4. Prevents duplicate charges during retry scenarios.</p>
           </div>
        </div>
      </section>

      {/* Endpoint: Create Transfer */}
      <section className="space-y-8 bg-zinc-50 dark:bg-zinc-900/40 p-8 rounded-[40px] border border-zinc-200 dark:border-white/5">
        <div className="flex items-center gap-3">
           <span className="px-3 py-1 bg-indigo-600 text-[10px] font-black text-white rounded-lg tracking-widest">POST</span>
           <h3 className="text-xl font-bold font-mono tracking-tight text-slate-900 dark:text-white">/transfers</h3>
        </div>
        <p className="text-sm text-zinc-500 font-medium font-medium leading-relaxed">Initiates an atomic movement of value between two ledger accounts. This operation triggers the full fraud-detection and consensus pipeline.</p>
        
        <div className="space-y-4">
           <h4 className="text-[11px] font-black uppercase text-zinc-400 dark:text-zinc-600 tracking-[0.2em]">Request Payload</h4>
           <div className="p-6 bg-zinc-900 dark:bg-black rounded-3xl border border-white/5">
              <pre className="text-xs font-mono text-indigo-400 overflow-x-auto">
{`{
  "sender_id": "98b50e2d-dc99-43ef-b387-052637738f61",
  "receiver_id": "05263773-8f61-43ef-b387-98b50e2ddc99",
  "amount": 1250.50,
  "currency": "USD",
  "memo": "Invoice #4421 - Q2 Settlement",
  "metadata": {
    "ip_address": "192.168.1.1",
    "location": "NY_USA"
  }
}`}
              </pre>
           </div>
        </div>

        <div className="space-y-4">
           <h4 className="text-[11px] font-black uppercase text-zinc-400 dark:text-zinc-600 tracking-[0.2em]">Success Response</h4>
           <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">201 Created</span>
           </div>
           <div className="p-6 bg-zinc-900 dark:bg-black rounded-3xl border border-white/5 opacity-80">
              <pre className="text-xs font-mono text-zinc-400 overflow-x-auto">
{`{
  "transaction_id": "0x55adef1...",
  "status": "committed",
  "timestamp": "2026-04-04T12:00:00Z",
  "audit_hash": "a4fde82..."
}`}
              </pre>
           </div>
        </div>
      </section>

      {/* Failure Cases */}
      <section className="space-y-6">
        <h3 className="text-xl font-bold font-black text-slate-900 dark:text-white">Return States & Handlers</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           <div className="p-6 bg-white dark:bg-white/[0.01] border border-zinc-200 dark:border-white/5 rounded-3xl">
              <span className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest mb-2 block">400 Bad Request</span>
              <p className="text-xs text-zinc-500 font-medium leading-relaxed">Invalid balance vs amount or non-existent sender/receiver ID.</p>
           </div>
           <div className="p-6 bg-white dark:bg-white/[0.01] border border-zinc-200 dark:border-white/5 rounded-3xl">
              <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-2 block">429 Too Many Requests</span>
              <p className="text-xs text-zinc-500 font-medium leading-relaxed">Rate limit exceeded. Check your subscription tier burst allowance.</p>
           </div>
           <div className="p-6 bg-white dark:bg-white/[0.01] border border-zinc-200 dark:border-white/5 rounded-3xl">
              <span className="text-[10px] font-black text-zinc-600 dark:text-zinc-600 uppercase tracking-widest mb-2 block">403 Forbidden</span>
              <p className="text-xs text-zinc-500 font-medium leading-relaxed">Fraud engine trigger. Account blocked due to suspicious velocity signals.</p>
           </div>
        </div>
      </section>
    </div>
  );
}
