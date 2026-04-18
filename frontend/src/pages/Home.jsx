import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { ThemeContext } from '../App';
import { isAuthenticated, getRoleFromToken } from '../lib/auth';

export function Home() {
  const { isDark, toggleTheme } = useContext(ThemeContext);

  return (
    <div className="min-h-screen w-full flex flex-col bg-white dark:bg-[#08090A] text-slate-900 dark:text-white transition-colors overflow-x-hidden">
      
      {/* Navigation */}
      <nav className="w-full flex items-center justify-between px-8 py-6 border-b border-zinc-200 dark:border-white/5 bg-white/80 dark:bg-[#08090A]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 dark:bg-white rounded-lg flex items-center justify-center shadow-lg">
            <span className="material-symbols-outlined text-white dark:text-black text-[18px]">security</span>
          </div>
          <span className="font-black tracking-tighter text-xl">SentinelClear</span>
        </div>
        
        <div className="hidden md:flex items-center gap-10 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
          <Link to="/docs" className="hover:text-indigo-600 dark:hover:text-white transition-colors">Documentation</Link>
          <Link to="/dashboard" className="hover:text-indigo-600 dark:hover:text-white transition-colors">Platform</Link>
          <a href="#features" className="hover:text-indigo-600 dark:hover:text-white transition-colors">Security</a>
          <a href="#how-it-works" className="hover:text-indigo-600 dark:hover:text-white transition-colors">How It Works</a>
        </div>
        
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="text-zinc-500 hover:text-indigo-600 dark:hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">{isDark ? 'light_mode' : 'dark_mode'}</span>
          </button>
          <Link to="/login" className="px-5 py-2.5 bg-indigo-600 dark:bg-white text-white dark:text-black font-black uppercase tracking-widest rounded-xl text-[10px] transition-all hover:scale-105 active:scale-95 shadow-lg">
            Sign In
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex flex-col items-center justify-center text-center px-6 pt-32 pb-40 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[500px] bg-indigo-500/10 blur-[120px] rounded-full -z-10"></div>
        
        <div className="inline-flex items-center gap-2 mb-10 px-4 py-2 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-full animate-in fade-in slide-in-from-bottom-4 duration-700">
           <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"></span>
           <span className="text-[10px] uppercase font-black tracking-[0.3em] text-zinc-600 dark:text-zinc-300">V4.0 Rule-Engine Production Build</span>
        </div>

        <h1 className="text-6xl md:text-[110px] font-black tracking-tighter mb-10 max-w-6xl leading-[0.85] text-slate-900 dark:text-white animate-in fade-in slide-in-from-bottom-6 duration-1000">
          The transaction engine <br />
          <span className="text-zinc-400 dark:text-zinc-600">you can trust.</span>
        </h1>
        
        <p className="text-lg md:text-2xl text-zinc-600 dark:text-zinc-400 max-w-2xl mb-14 font-medium leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
          A high-velocity financial infrastructure embedding atomic double-entry accounting with real-time fraud prevention. Built for the critical path.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-6 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-300">
          <Link to="/dashboard" className="w-full sm:w-auto px-8 py-4 bg-indigo-600 dark:bg-white text-white dark:text-black font-black uppercase tracking-widest rounded-2xl text-xs transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 group shadow-xl">
            {isAuthenticated() && getRoleFromToken() === 'ADMIN' ? 'Launch Ops Hub' : 'Launch Platform'} <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </Link>
          <Link to="/docs" className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white font-black uppercase tracking-widest rounded-2xl text-xs transition-all hover:bg-zinc-50 dark:hover:bg-white/10 flex items-center justify-center gap-2">
            Read Documentation
          </Link>
        </div>
      </main>

      {/* Bento Feature Grid */}
      <section id="features" className="w-full max-w-7xl mx-auto px-6 pb-40">
        <div className="text-center mb-16">
          <span className="text-[10px] uppercase font-black tracking-[0.3em] text-indigo-500 mb-4 block">Core Capabilities</span>
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-slate-900 dark:text-white">Built for zero-tolerance systems.</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           
           {/* Primary Bento: Double-Click Protection */}
           <div className="md:col-span-2 bg-zinc-50 dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-[40px] p-12 flex flex-col justify-between group overflow-hidden relative">
              <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 group-hover:opacity-10 transition-opacity">
                 <span className="material-symbols-outlined text-[200px] text-indigo-500">repeat</span>
              </div>
              <div>
                <span className="material-symbols-outlined text-indigo-500 text-4xl mb-6">verified_user</span>
                <h3 className="text-4xl font-black tracking-tighter mb-4 text-slate-900 dark:text-white">Double-Click Protection</h3>
                <p className="text-xl text-zinc-600 dark:text-zinc-500 font-medium leading-relaxed max-w-md">
                   Our Exactly-Once execution semantics ensure that network retries or accidental double-clicks never result in duplicate charges.
                </p>
              </div>
              <div className="mt-20 flex gap-4">
                 <div className="px-5 py-2 bg-zinc-200 dark:bg-white/5 border border-zinc-300 dark:border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-zinc-500">Atomic Ids</div>
                 <div className="px-5 py-2 bg-zinc-200 dark:bg-white/5 border border-zinc-300 dark:border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-zinc-500">24H Caching</div>
              </div>
           </div>

           {/* Secondary Bento: Smart Fraud Guard */}
           <div className="bg-zinc-50 dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-[40px] p-10 flex flex-col justify-between hover:border-indigo-500/30 transition-colors">
              <div>
                <span className="material-symbols-outlined text-amber-500 text-3xl mb-6">security</span>
                <h3 className="text-3xl font-black tracking-tighter mb-4 text-slate-900 dark:text-white">Smart Fraud Guard</h3>
                <p className="text-lg text-zinc-600 dark:text-zinc-500 font-medium leading-relaxed">
                   Real-time behavior analysis scores every transaction against a policy matrix in sub-50ms.
                </p>
              </div>
              <div className="w-full h-1 bg-zinc-200 dark:bg-white/5 rounded-full overflow-hidden mt-10">
                 <div className="w-3/4 h-full bg-amber-500 animate-pulse"></div>
              </div>
           </div>

           {/* Small Bento: Anti-Tamper Seal */}
           <div className="bg-zinc-50 dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-[40px] p-10 flex flex-col justify-between hover:border-indigo-500/30 transition-colors">
              <div>
                <span className="material-symbols-outlined text-emerald-500 text-3xl mb-6">history_edu</span>
                <h3 className="text-3xl font-black tracking-tighter mb-4 text-slate-900 dark:text-white">Anti-Tamper Seal</h3>
                <p className="text-lg text-zinc-600 dark:text-zinc-500 font-medium leading-relaxed">
                   Every mutation is signed and appended to an immutable record chain, providing a permanent audit trail.
                </p>
              </div>
           </div>

           {/* Small Bento: Atomic Finality */}
           <div className="md:col-span-2 bg-zinc-50 dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-[40px] p-10 md:p-12 flex flex-col md:flex-row items-center justify-between gap-10 hover:border-indigo-500/30 transition-colors">
              <div className="max-w-md">
                <span className="material-symbols-outlined text-rose-500 text-3xl mb-6">account_balance</span>
                <h3 className="text-4xl font-black tracking-tighter mb-4 text-slate-900 dark:text-white">Atomic Finality</h3>
                <p className="text-xl text-zinc-600 dark:text-zinc-500 font-medium leading-relaxed">
                   Financial integrity is maintained through a zero-sum double-entry ledger. Money is never lost, only moved.
                </p>
              </div>
              <div className="flex-1 w-full bg-white dark:bg-black/40 border border-zinc-200 dark:border-white/5 rounded-3xl p-6 font-mono text-[12px] text-emerald-600 dark:text-emerald-500/70">
                 <p className="mb-2 text-zinc-400 dark:text-zinc-600">// Ledger Consistency Check</p>
                 <p>ASSERT balance_sum === 0.00;</p>
                 <p className="mt-4 text-emerald-600 dark:text-emerald-500 font-black">STATUS: VERIFIED</p>
              </div>
           </div>

        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="w-full max-w-7xl mx-auto px-6 pb-40">
        <div className="text-center mb-20">
          <span className="text-[10px] uppercase font-black tracking-[0.3em] text-indigo-500 mb-4 block">Transaction Pipeline</span>
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-slate-900 dark:text-white">How every transfer is secured.</h2>
          <p className="text-lg text-zinc-500 mt-4 max-w-2xl mx-auto font-medium">Every transaction passes through a multi-layer security pipeline before funds move.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {[{
            step: '01', icon: 'fingerprint', color: 'indigo',
            title: 'Identity Verification',
            desc: 'JWT token validation confirms the authenticated user. Session binding prevents token hijacking.'
          }, {
            step: '02', icon: 'gavel', color: 'amber',
            title: 'Regulatory Checks',
            desc: 'Layer 1 hard blocks enforce RTGS floors, daily velocity caps, and new beneficiary cooling-off limits.'
          }, {
            step: '03', icon: 'psychology', color: 'rose',
            title: 'Risk Scoring',
            desc: 'Layer 2 heuristic engine evaluates burst velocity, amount anomaly, geo-velocity, and time-of-day signals.'
          }, {
            step: '04', icon: 'check_circle', color: 'emerald',
            title: 'Atomic Settlement',
            desc: 'Double-entry ledger atomically debits sender and credits receiver. SHA-256 hash chain seals the audit trail.'
          }].map(item => (
            <div key={item.step} className="relative group">
              <div className="bg-zinc-50 dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-3xl p-8 hover:border-indigo-500/30 transition-all h-full flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-5xl font-black text-zinc-200 dark:text-zinc-800 tracking-tighter">{item.step}</span>
                  <div className={`w-10 h-10 rounded-xl bg-${item.color}-500/10 flex items-center justify-center`}>
                    <span className={`material-symbols-outlined text-${item.color}-500 text-xl`}>{item.icon}</span>
                  </div>
                </div>
                <h4 className="text-lg font-black tracking-tight text-slate-900 dark:text-white mb-3">{item.title}</h4>
                <p className="text-sm text-zinc-500 font-medium leading-relaxed flex-1">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Live Metrics Strip */}
      <section className="w-full border-y border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-[#0a0a0b] py-20">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { label: 'Fraud Rules Active', value: '13', sub: 'Across 3 layers' },
            { label: 'Avg. Scoring Latency', value: '<50ms', sub: 'Per transaction' },
            { label: 'Ledger Integrity', value: '100%', sub: 'Zero-sum verified' },
            { label: 'Audit Coverage', value: 'SHA-256', sub: 'Hash-chained entries' },
          ].map((stat, i) => (
            <div key={i} className="space-y-2">
              <p className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900 dark:text-white font-mono">{stat.value}</p>
              <p className="text-sm font-black text-zinc-900 dark:text-zinc-300 uppercase tracking-wider">{stat.label}</p>
              <p className="text-xs text-zinc-500 font-medium">{stat.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Security Layers Deep Dive */}
      <section className="w-full max-w-7xl mx-auto px-6 py-40">
        <div className="text-center mb-20">
          <span className="text-[10px] uppercase font-black tracking-[0.3em] text-indigo-500 mb-4 block">Defense In Depth</span>
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-slate-900 dark:text-white">Three layers of protection.</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-zinc-50 dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-3xl p-10 hover:border-rose-500/30 transition-all group">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-rose-500 text-3xl">block</span>
            </div>
            <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mb-3">Layer 1 — Hard Blocks</h3>
            <p className="text-sm text-zinc-500 font-medium leading-relaxed mb-6">
              Regulatory-grade rules that instantly reject transactions violating compliance thresholds. No funds move, no records created.
            </p>
            <ul className="space-y-2 text-xs text-zinc-500 font-bold">
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> RTGS Minimum Floor — ₹2,00,000</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Daily Velocity — 20 transfers/day</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> New Beneficiary Cooling-Off — ₹50,000</li>
            </ul>
          </div>

          <div className="bg-zinc-50 dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-3xl p-10 hover:border-amber-500/30 transition-all group">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-amber-500 text-3xl">analytics</span>
            </div>
            <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mb-3">Layer 2 — Heuristic Scoring</h3>
            <p className="text-sm text-zinc-500 font-medium leading-relaxed mb-6">
              Weighted scoring across behavioral signals. Each rule contributes to a composite risk score between 0.0 and 1.0.
            </p>
            <ul className="space-y-2 text-xs text-zinc-500 font-bold">
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Burst Velocity — 3+ in 60s</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Amount Anomaly — 5× historical avg</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Impossible Travel — Geo velocity</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Time of Day — Midnight–5AM IST</li>
            </ul>
          </div>

          <div className="bg-zinc-50 dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-3xl p-10 hover:border-violet-500/30 transition-all group">
            <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-violet-500 text-3xl">pattern</span>
            </div>
            <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mb-3">Layer 3 — Pattern Analysis</h3>
            <p className="text-sm text-zinc-500 font-medium leading-relaxed mb-6">
              Domain-specific anomaly detection identifies sophisticated fraud patterns that evade individual rule checks.
            </p>
            <ul className="space-y-2 text-xs text-zinc-500 font-bold">
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span> Smurfing / Split Structuring</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span> Account Drain Prediction — 95%+</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span> Recipient Concentration</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Technology Stack */}
      <section className="w-full max-w-7xl mx-auto px-6 pb-40">
        <div className="bg-zinc-50 dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-[40px] p-12 md:p-20 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-indigo-500/5 rounded-full blur-[100px]"></div>
          <div className="relative z-10">
            <span className="text-[10px] uppercase font-black tracking-[0.3em] text-indigo-500 mb-4 block">Technology</span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900 dark:text-white mb-6">Production-grade stack.</h2>
            <p className="text-lg text-zinc-500 font-medium max-w-2xl mb-12">
              Every component is chosen for reliability, performance, and auditability at financial-grade standards.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 relative z-10">
            {[
              { name: 'FastAPI', desc: 'Async Python API', icon: 'bolt' },
              { name: 'PostgreSQL', desc: 'ACID-compliant store', icon: 'storage' },
              { name: 'Redis', desc: 'Cache & rate limiting', icon: 'speed' },
              { name: 'RabbitMQ', desc: 'Async task processing', icon: 'hub' },
              { name: 'SQLAlchemy', desc: 'Async ORM + migrations', icon: 'database' },
              { name: 'React + Vite', desc: 'Modern SPA frontend', icon: 'web' },
              { name: 'Docker', desc: 'Containerized deploy', icon: 'deployed_code' },
              { name: 'Firebase Auth', desc: 'OAuth 2.0 provider', icon: 'lock' },
            ].map((tech, i) => (
              <div key={i} className="bg-white dark:bg-black/30 border border-zinc-200 dark:border-white/5 rounded-2xl p-5 hover:border-indigo-500/20 transition-all">
                <span className="material-symbols-outlined text-indigo-500 text-xl mb-3 block">{tech.icon}</span>
                <p className="text-sm font-black text-slate-900 dark:text-white tracking-tight">{tech.name}</p>
                <p className="text-[11px] text-zinc-500 font-medium mt-1">{tech.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="w-full max-w-5xl mx-auto px-6 pb-40 text-center">
        <h2 className="text-5xl md:text-7xl font-black tracking-tighter text-slate-900 dark:text-white mb-6">
          Ready to get started?
        </h2>
        <p className="text-xl text-zinc-500 font-medium max-w-xl mx-auto mb-10">
          Create an account and experience the platform. Transfers are protected by real-time fraud detection from your first transaction.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <Link to="/register" className="px-10 py-5 bg-indigo-600 dark:bg-white text-white dark:text-black font-black uppercase tracking-widest rounded-2xl text-xs transition-all hover:scale-105 active:scale-95 shadow-xl flex items-center gap-3">
            Create Free Account <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Link>
          <Link to="/docs/quickstart" className="px-10 py-5 bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white font-black uppercase tracking-widest rounded-2xl text-xs transition-all hover:bg-zinc-50 dark:hover:bg-white/10">
            Quickstart Guide
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full py-20 border-t border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-[#040506]">
        <div className="max-w-7xl mx-auto px-8 grid grid-cols-1 md:grid-cols-4 gap-12">
           <div className="md:col-span-2 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center bg-indigo-600 dark:bg-white text-white dark:text-black rounded-lg shadow-md">
                   <span className="material-symbols-outlined text-[18px]">security</span>
                </div>
                <span className="font-black tracking-tighter text-xl text-slate-900 dark:text-white">SentinelClear</span>
              </div>
              <p className="text-zinc-600 dark:text-zinc-500 font-medium max-w-sm">
                The next-generation financial infrastructure for systems that require absolute assurance.
              </p>
              <p className="text-[11px] text-zinc-400 font-bold">© 2026 SentinelClear. All rights reserved.</p>
           </div>
           
           <div className="space-y-6">
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-600">Platform</h4>
              <ul className="space-y-4 text-sm font-bold text-zinc-500">
                <li><Link to="/docs" className="hover:text-indigo-600 dark:hover:text-white transition-colors">Documentation</Link></li>
                <li><Link to="/docs/api-reference" className="hover:text-indigo-600 dark:hover:text-white transition-colors">API Reference</Link></li>
                <li><Link to="/dashboard" className="hover:text-indigo-600 dark:hover:text-white transition-colors">{isAuthenticated() && getRoleFromToken() === 'ADMIN' ? 'Operations Hub' : 'Dashboard'}</Link></li>
                <li><Link to="/docs/risk-engine" className="hover:text-indigo-600 dark:hover:text-white transition-colors">Risk Engine</Link></li>
              </ul>
           </div>

           <div className="space-y-6">
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-600">Resources</h4>
              <ul className="space-y-4 text-sm font-bold text-zinc-500">
                <li><Link to="/docs/quickstart" className="hover:text-indigo-600 dark:hover:text-white transition-colors">Quickstart</Link></li>
                <li><Link to="/docs/ledger-architecture" className="hover:text-indigo-600 dark:hover:text-white transition-colors">Architecture</Link></li>
                <li><Link to="/docs/credit-hub" className="hover:text-indigo-600 dark:hover:text-white transition-colors">Credit Hub</Link></li>
                <li className="hover:text-indigo-600 dark:hover:text-white transition-colors cursor-pointer">Privacy Policy</li>
              </ul>
           </div>
        </div>
      </footer>
    </div>
  );
}
