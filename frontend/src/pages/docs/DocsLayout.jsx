import React, { useState, useContext, useEffect } from 'react';
import { NavLink, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { ThemeContext } from '../../App';

const sidebarCategories = [
  {
    title: 'OVERVIEW',
    items: [
      { id: 'introduction', label: 'What is SentinelClear?' },
      { id: 'quickstart', label: 'Quickstart & Integration' },
    ]
  },
  {
    title: 'CORE PLATFORM',
    items: [
      { id: 'ledger-architecture', label: 'Ledger Architecture' },
      { id: 'risk-engine', label: 'Rule-Based Risk Engine' },
      { id: 'upi-safety', label: 'UPI Safety Framework' },
      { id: 'credit-hub', label: 'Credit & Loan Hub' },
    ]
  },
  {
    title: 'RESOURCES',
    items: [
      { id: 'api-reference', label: 'API Reference' },
    ]
  }
];

export function DocsLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark } = useContext(ThemeContext);

  // Scroll to top on navigation in documentation
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-white dark:bg-[#09090b] text-slate-900 dark:text-zinc-300 font-sans selection:bg-indigo-500/30">
      
      {/* Mobile Top Navigation */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-zinc-200 dark:border-white/10 bg-white dark:bg-[#09090b] sticky top-0 z-40">
        <div className="flex items-center gap-2 px-1 cursor-pointer" onClick={() => navigate('/dashboard')}>
           <div className="w-5 h-5 bg-slate-900 dark:bg-white rounded flex items-center justify-center">
              <span className="material-symbols-outlined text-white dark:text-black text-[12px]">code</span>
           </div>
           <span className="font-bold text-sm text-slate-900 dark:text-white">SentinelDocs</span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-1.5 transition-colors hover:bg-zinc-100 dark:hover:bg-white/10 rounded-md text-zinc-500 dark:text-zinc-400"
        >
          <span className="material-symbols-outlined text-[20px]">{isSidebarOpen ? 'close' : 'menu'}</span>
        </button>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-40 md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar - Plaid Style */}
      <aside className={`
        fixed md:sticky top-0 h-screen w-[260px] bg-[#fcfcfc] dark:bg-[#09090b] border-r border-zinc-200 dark:border-zinc-800/50 
        z-50 transform transition-transform duration-300 md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col overflow-y-auto hide-scrollbar
      `}>
        {/* Brand Header */}
        <div className="pt-8 pb-6 px-6 hidden md:block">
           <div 
             className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
             onClick={() => navigate('/dashboard')}
           >
              <div className="w-6 h-6 bg-slate-900 dark:bg-zinc-100 rounded-[6px] flex items-center justify-center">
                 <span className="material-symbols-outlined text-white dark:text-black text-[14px]">terminal</span>
              </div>
              <span className="font-semibold text-[15px] tracking-tight text-slate-900 dark:text-white">SentinelClear</span>
           </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-4 py-4 space-y-8">
          {sidebarCategories.map(category => (
            <div key={category.title}>
              <h4 className="px-3 mb-2 text-[11px] font-semibold tracking-wider text-slate-500 dark:text-zinc-500">
                {category.title}
              </h4>
              <div className="space-y-[2px]">
                {category.items.map(item => {
                  const isActive = location.pathname.includes(item.id);
                  return (
                    <NavLink
                      key={item.id}
                      to={`/docs/${item.id}`}
                      onClick={() => setIsSidebarOpen(false)}
                      className={`
                        block px-3 py-[6px] rounded-md text-[13.5px] font-medium transition-colors
                        ${isActive 
                          ? 'bg-blue-50/50 dark:bg-indigo-500/10 text-blue-600 dark:text-indigo-400' 
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.03]'}
                      `}
                    >
                      {item.label}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content Area - Center Focused */}
      <main className="flex-1 w-full bg-white dark:bg-[#09090b] min-h-screen pb-32">
        <div className="max-w-[760px] mx-auto px-6 py-12 md:px-12 md:py-16">
           <article className="prose prose-slate dark:prose-invert prose-p:font-medium prose-p:text-slate-600 dark:prose-p:text-zinc-400 prose-headings:tracking-tight max-w-none">
              <Outlet />
           </article>
           
           <hr className="my-16 border-zinc-200 dark:border-zinc-800" />
           
           {/* Footer */}
           <footer className="flex flex-col items-start gap-4">
              <div className="flex gap-4">
                 <button onClick={() => navigate('/dashboard')} className="text-sm font-semibold text-blue-600 dark:text-indigo-400 hover:underline">
                    Back to Dashboard
                 </button>
                 <a href="#" className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white">API Keys</a>
              </div>
              <p className="text-xs text-slate-400 dark:text-zinc-600">
                 © 2026 Sentinel Ledger Systems.
              </p>
           </footer>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        /* Custom Prose Adjustments for Plaid-like technical feel */
        .prose h1 { font-size: 2.25rem; font-weight: 700; color: var(--tw-prose-headings); margin-bottom: 1.5rem; letter-spacing: -0.02em; }
        .prose h2 { font-size: 1.5rem; font-weight: 600; margin-top: 3rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid rgba(150,150,150,0.1); }
        .prose h3 { font-size: 1.125rem; font-weight: 600; margin-top: 2rem; color: var(--tw-prose-headings); }
        .prose code { padding: 0.2em 0.4em; font-size: 85%; font-weight: 500; background-color: rgba(175, 184, 193, 0.2); border-radius: 6px; }
        .dark .prose code { background-color: rgba(110, 118, 129, 0.4); color: #e2e8f0; }
        .prose pre { padding: 1.25rem; border-radius: 12px; background: #0f172a; overflow-x: auto; font-size: 0.875rem; line-height: 1.5rem; margin-top: 1.5rem; margin-bottom: 1.5rem; }
        .dark .prose pre { border: 1px solid rgba(255,255,255,0.05); }
        .prose a { color: #2563eb; text-decoration: none; font-weight: 500; }
        .dark .prose a { color: #818cf8; }
        .prose a:hover { text-decoration: underline; }
        .prose ul > li::marker { color: #94a3b8; }
        .dark .prose ul > li::marker { color: #475569; }
      `}} />
    </div>
  );
}
