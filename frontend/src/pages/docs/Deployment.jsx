import React from 'react';

export default function Deployment() {
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000 ease-out">
      <header className="space-y-4">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[0.95]">
          System <span className="text-indigo-600">Deployment</span>.
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed max-w-2xl">
          SentinelClear v3.0 is designed for containerized orchestration. The following architecture ensures that each component can scale independently while maintaining strict network isolation.
        </p>
      </header>

      <hr className="border-zinc-100 dark:border-white/5" />

      {/* Docker Compose Section */}
      <section className="space-y-8">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white underline decoration-indigo-600/30 underline-offset-8">Container Orchestration</h2>
        <p className="text-sm text-zinc-500 font-medium leading-relaxed">
          The base environment consists of 7 tightly-coupled containers. Communication between internal services (DB, Redis, RabbitMQ) is strictly limited to the private Docker network.
        </p>
        
        <div className="p-8 bg-zinc-900 dark:bg-black rounded-[40px] border border-white/10 relative group">
           <h4 className="text-[11px] font-black uppercase text-zinc-400 dark:text-zinc-600 tracking-[0.2em] mb-4">Architecture Matrix (docker-compose)</h4>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { name: 'sentinel_api', role: 'FastAPI Entry', port: '8000' },
                { name: 'sentinel_db', role: 'PostgreSQL 16', port: '5432' },
                { name: 'sentinel_cache', role: 'Redis 7', port: '6379' },
                { name: 'sentinel_bus', role: 'RabbitMQ', port: '5672' },
                { name: 'sentinel_worker', role: 'Celery/Async', port: 'None' },
                { name: 'sentinel_mon', role: 'Prometheus', port: '9090' },
                { name: 'sentinel_viz', role: 'Grafana', port: '3000' }
              ].map((service) => (
                <div key={service.name} className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl space-y-2 group transition-colors hover:bg-white/5">
                  <h5 className="text-[10px] font-black text-indigo-400 font-mono italic">{service.name}</h5>
                  <p className="text-xs font-bold text-white uppercase tracking-tighter">{service.role}</p>
                  <span className="text-[9px] text-zinc-600 font-mono">Internal Port: {service.port}</span>
                </div>
              ))}
           </div>
        </div>
      </section>

      {/* Deployment Flow */}
      <section className="space-y-10">
         <h3 className="text-3xl font-black text-slate-900 dark:text-white underline decoration-indigo-600/30 underline-offset-8">Production Launch Strategy</h3>
         
         <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="p-8 bg-zinc-50 dark:bg-white/[0.01] border border-zinc-200 dark:border-white/5 rounded-3xl">
               <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-widest mb-4">Phase 1: Environment Hardening</h4>
               <p className="text-sm text-zinc-500 font-medium leading-relaxed italic border-l-2 border-indigo-600/20 pl-4 py-2">
                 Verify all `VITE_API_URL` and `DATABASE_URL` secrets are injected via a secure Vault or Environment Manager. Never use plaintext passwords in `docker-compose.yml`.
               </p>
            </div>
            <div className="p-8 bg-zinc-50 dark:bg-white/[0.01] border border-zinc-200 dark:border-white/5 rounded-3xl">
               <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-widest mb-4">Phase 2: Orchestration Spin-up</h4>
               <p className="text-sm text-zinc-500 font-medium leading-relaxed italic border-l-2 border-indigo-600/20 pl-4 py-2 uppercase tracking-tight">
                 `docker-compose up -d --build`. This initiates the 7-container chain.
               </p>
            </div>
         </div>
      </section>

      {/* Rule Notice */}
      <div className="p-8 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-3xl flex gap-8 items-center border border-white/10 group shadow-2xl">
         <div className="space-y-2 flex-1">
            <h4 className="font-black text-[12px] uppercase tracking-[0.4em] mb-2 opacity-60">System Resilience Rule</h4>
            <p className="text-2xl font-black leading-tight tracking-tight uppercase">
               "If DB becomes unavailable, the Sentinel Worker stays alive. Transactions stay in the bus."
            </p>
         </div>
         <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-2xl shadow-indigo-500/40 opacity-30 transition-all group-hover:scale-125 group-hover:rotate-6">
            <span className="material-symbols-outlined text-white text-3xl">rocket_launch</span>
         </div>
      </div>

    </div>
  );
}
