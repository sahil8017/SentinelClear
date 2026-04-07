import React from 'react';

export default function Observability() {
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000 ease-out">
      <header className="space-y-4">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[0.95]">
          Observability <span className="text-indigo-600">Framework</span>.
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed max-w-2xl">
          SentinelClear includes a first-class observability suite, providing real-time insights into ledger health, transaction velocity, and infrastructure resilience.
        </p>
      </header>

      <hr className="border-zinc-100 dark:border-white/5" />

      {/* Metrics Section */}
      <section className="space-y-8">
        <h2 className="text-3xl font-black text-slate-900 dark:text-white underline decoration-indigo-600/30 underline-offset-8">Metrics & Prometheus</h2>
        <p className="text-sm text-zinc-500 font-medium leading-relaxed">
          The core engine exposes a `/metrics` endpoint compatible with <span className="text-indigo-600 dark:text-indigo-400 font-bold">Prometheus</span>. This allows for fine-grained monitoring of internal state without impacting request latency.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="p-6 bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 rounded-3xl space-y-4 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500">
              <span className="material-symbols-outlined absolute top-4 right-4 text-4xl text-indigo-500/10 group-hover:scale-125 transition-transform duration-1000">monitoring</span>
              <h4 className="font-bold text-slate-900 dark:text-white">Transaction Throughput</h4>
              <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                 Real-time count of successfully committed vs rejected transactions. Tracks burst capacity vs baseline.
              </p>
           </div>
           
           <div className="p-6 bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 rounded-3xl space-y-4 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500">
              <span className="material-symbols-outlined absolute top-4 right-4 text-4xl text-red-500/10 group-hover:scale-125 transition-transform duration-1000">gpp_maybe</span>
              <h4 className="font-bold text-slate-900 dark:text-white">Fraud Signal Latency</h4>
              <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                 The time taken (ms) for the fraud engine to evaluate all 6 core signals before ledger locking.
              </p>
           </div>
        </div>
      </section>

      {/* Chaos Simulator Section */}
      <section className="space-y-8 p-10 bg-zinc-900 dark:bg-black rounded-[40px] border border-white/5 overflow-hidden group">
         <div className="flex items-center gap-4 mb-4">
            <span className="material-symbols-outlined text-red-500 text-3xl transition-transform group-hover:rotate-180 duration-1000">bolt</span>
            <h3 className="text-2xl font-black text-white">The Chaos Simulator</h3>
         </div>
         <p className="text-sm text-zinc-500 leading-relaxed font-medium mb-8">
            SentinelClear includes a native Chaos Engineering tool. It is designed to intentionally inject failures (killing the DB container, dropping Redis connections) to verify system resilience.
         </p>
         
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
               <h4 className="text-[10px] font-black uppercase text-red-500 tracking-widest px-2 py-1 bg-red-500/10 rounded w-fit italic">The RabbitMQ DLQ Strategy</h4>
               <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                  During a simulated DB failure, transactions are not lost. They are acknowledged by RabbitMQ and moved to a <span className="text-white font-black">Dead Letter Queue (DLQ)</span>. Once the DB container recovers, the worker automatically re-processes these messages, ensuring 100% finality.
               </p>
            </div>
            <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl flex items-center justify-center italic text-xs text-zinc-600 font-mono">
               System Resilience: 99.999% Expected Uptime under Chaos-Injection.
            </div>
         </div>
      </section>

      {/* Final Note Box */}
      <div className="p-8 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-3xl">
         <h4 className="font-black text-sm uppercase tracking-[0.3em] mb-4 opacity-70">Implementation Rule #08</h4>
         <p className="text-lg font-bold leading-tight">
            "All Observability dashboards must be isolated from the main transaction path. Metrics scraping should never cause transaction latency spikes."
         </p>
      </div>

    </div>
  );
}
