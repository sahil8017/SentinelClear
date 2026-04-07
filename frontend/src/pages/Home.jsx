import React, { useContext, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ThemeContext } from '../App';
import { isAuthenticated, getRoleFromToken } from '../lib/auth';

export function Home() {
  const { isDark, toggleTheme } = useContext(ThemeContext);
  const navigate = useNavigate();

  useEffect(() => {
    // Intentionally removed unconditional role-based redirect
    // Authenticated users should still be able to read the root landing page.
  }, []);

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
           <span className="text-[10px] uppercase font-black tracking-[0.3em] text-zinc-600 dark:text-zinc-300">V3.0 Production Engine Implemented</span>
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
      <section id="features" className="w-full max-w-7xl mx-auto px-6 pb-60">
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
           </div>
           
           <div className="space-y-6">
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-600">Engineering</h4>
              <ul className="space-y-4 text-sm font-bold text-zinc-500">
                <li><Link to="/docs" className="hover:text-indigo-600 dark:hover:text-white transition-colors">Documentation</Link></li>
                <li><Link to="/dashboard" className="hover:text-indigo-600 dark:hover:text-white transition-colors">{isAuthenticated() && getRoleFromToken() === 'ADMIN' ? 'Operations Hub' : 'Platform'}</Link></li>
              </ul>
           </div>

           <div className="space-y-6">
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-600">Company</h4>
              <ul className="space-y-4 text-sm font-bold text-zinc-500">
                <li className="hover:text-indigo-600 dark:hover:text-white transition-colors cursor-pointer">Privacy</li>
                <li className="hover:text-indigo-600 dark:hover:text-white transition-colors cursor-pointer">Terms</li>
              </ul>
           </div>
        </div>
      </footer>
    </div>
  );
}
