import React, { useState, useContext } from 'react';
import { NavLink, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { ThemeContext } from '../../App';

const sidebarCategories = [
  {
    title: 'Getting Started',
    items: [
      { id: 'introduction', label: 'System Overview', icon: 'auto_awesome' },
      { id: 'sdk-setup', label: 'Initializing SDK', icon: 'settings_input_antenna' },
      { id: 'api-reference', label: 'API Reference', icon: 'api' },
    ]
  },
  {
    title: 'Core Ledger Primitives',
    items: [
      { id: 'idempotency', label: 'Atomic Idempotency', icon: 'repeat' },
      { id: 'ledger-primitives', label: 'Accounting Rules', icon: 'account_balance' },
      { id: 'settlement-logic', label: 'Settlement Logic', icon: 'bolt' },
    ]
  },
  {
    title: 'Security & Operations',
    items: [
      { id: 'fraud-heuristics', label: 'Fraud Detection', icon: 'security' },
      { id: 'audit-chain', label: 'Audit Hash Chaining', icon: 'history_edu' },
      { id: 'observability', label: 'Metrics & Chaos', icon: 'monitoring' },
      { id: 'deployment', label: 'Docker Architecture', icon: 'rocket_launch' },
    ]
  }
];

export function DocsLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark } = useContext(ThemeContext);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-white dark:bg-[#080808] text-slate-900 dark:text-white overflow-hidden transition-colors selection:bg-indigo-500/30">
      
      {/* Mobile Top Navigation */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-zinc-200 dark:border-white/5 bg-white/80 dark:bg-[#0c0c0d]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="flex items-center gap-2 px-1">
           <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="material-symbols-outlined text-white text-[14px]">terminal</span>
           </div>
           <span className="font-black tracking-tighter text-xs uppercase text-slate-900 dark:text-white">Sentinel_Docs</span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 transition-colors hover:bg-zinc-100 dark:hover:bg-white/5 rounded-xl text-zinc-500 dark:text-zinc-400"
        >
          <span className="material-symbols-outlined">{isSidebarOpen ? 'close' : 'menu'}</span>
        </button>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:relative inset-y-0 left-0 w-[300px] bg-zinc-50 dark:bg-[#0c0c0d] border-r border-zinc-200 dark:border-white/5 
        z-50 transform transition-shadow duration-500
        ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
        flex flex-col h-full transition-transform ease-[cubic-bezier(0.2,0,0,1)]
      `}>
        {/* Sidebar Brand Header */}
        <div className="p-8 mb-2 hidden md:flex items-center gap-4">
           <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-2xl shadow-indigo-500/20">
              <span className="material-symbols-outlined text-white text-[20px]">terminal</span>
           </div>
           <div className="flex flex-col">
              <span className="font-black tracking-tighter text-lg leading-none text-slate-900 dark:text-white uppercase">Vault</span>
              <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 tracking-[0.4em] mt-1 uppercase">Technical</span>
           </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto px-5 py-4 space-y-10 custom-scrollbar">
          {sidebarCategories.map(category => (
            <div key={category.title} className="space-y-4">
              <h3 className="px-3 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-600">{category.title}</h3>
              <div className="space-y-1.5">
                {category.items.map(item => (
                  <NavLink
                    key={item.id}
                    to={`/docs/${item.id}`}
                    onClick={() => setIsSidebarOpen(false)}
                    className={({ isActive }) => `
                      flex items-center gap-3.5 px-3 py-3 rounded-2xl text-[13px] font-bold transition-all duration-300 group
                      ${isActive 
                        ? 'bg-white dark:bg-white/[0.03] text-indigo-600 dark:text-indigo-400 border border-zinc-200 dark:border-white/10 shadow-sm' 
                        : 'text-zinc-500 hover:text-indigo-600 dark:hover:text-white hover:bg-white dark:hover:bg-white/5 border border-transparent'}
                    `}
                  >
                    <div className={`
                       w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300
                       ${location.pathname.includes(item.id) 
                         ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' 
                         : 'bg-zinc-100 dark:bg-white/5 text-zinc-400 group-hover:bg-indigo-600 group-hover:text-white'}
                    `}>
                       <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                    </div>
                    <span className="tracking-tight">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-8">
           <div className="p-6 bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 rounded-[24px]">
              <div className="flex items-center justify-between mb-3 text-[9px] font-black uppercase text-zinc-400 dark:text-zinc-700 tracking-[0.3em]">
                 <span>Engine Status</span>
                 <div className="flex gap-1">
                    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                 </div>
              </div>
              <p className="text-[11px] font-mono font-black text-indigo-600 dark:text-indigo-500 tracking-tighter uppercase italic">v3.0.8-ALPHA-STABLE</p>
           </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-[#080808] selection:text-white">
        <div className="max-w-4xl mx-auto px-6 py-16 md:px-20 md:py-24 animate-in fade-in slide-in-from-bottom-6 duration-1000 ease-[cubic-bezier(0.2,0,0,1)]">
           <div className="prose prose-slate dark:prose-invert max-w-none">
              <Outlet />
           </div>
           
           {/* Comprehensive Technical Footer */}
           <footer className="mt-24 pt-12 border-t border-zinc-100 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 opacity-60 hover:opacity-100 transition-opacity">
              <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.2em] italic">© 2026 Sentinel Ledger Systems · Cryptographically Bound </p>
              <div className="flex gap-8">
                 <a href="#" className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 hover:text-indigo-600 dark:hover:text-indigo-400 uppercase tracking-widest transition-colors">Forensic Scanner</a>
                 <button onClick={() => navigate('/dashboard')} className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:underline hover:scale-105 transition-all uppercase tracking-widest">Dashboard Entry</button>
              </div>
           </footer>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 3px; height: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.05); border-radius: 20px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.03); }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.4); }
        
        .tracking-tightest { letter-spacing: -0.05em; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}
