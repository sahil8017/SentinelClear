import React, { useState, useEffect, useContext } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { clearToken } from '../lib/auth';
import { ThemeContext } from '../App';
import apiClient from '../lib/axios';
import { toast } from 'sonner';

import { getRoleFromToken } from '../lib/auth';

const getNavForRole = (role) => {
  const common = [
    { name: 'Documentation', href: '/docs', icon: 'library_books' }
  ];

  if (role === 'ADMIN') {
    return [
      { name: 'Operations Hub', href: '/admin/ops', icon: 'hub' },
      { name: 'Security Analytics', href: '/admin/analytics', icon: 'shield_locked' },
      { name: 'Chaos Simulator', href: '/admin/chaos', icon: 'warning' },
      { name: 'Developer Tools', href: '/admin/tools', icon: 'terminal' },
      ...common
    ];
  }

  return [
    { name: 'Dashboard', href: '/app/dashboard', icon: 'dashboard' },
    { name: 'Transfers', href: '/app/transfer', icon: 'payments' },
    { name: 'Ledger Registry', href: '/app/ledger', icon: 'menu_book' },
    { name: 'Credit Hub', href: '/app/credit', icon: 'account_balance' },
    { name: 'Developer Portal', href: '/app/developers', icon: 'api' },
    ...common
  ];
};

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isDark, toggleTheme } = useContext(ThemeContext);
  const [account, setAccount] = useState(null);

  useEffect(() => {
    apiClient.get('/accounts/me')
      .then(res => setAccount(res.data))
      .catch(err => console.error('Account sync failed', err));
  }, []);

  const copyAccountId = () => {
    if (!account) return;
    navigator.clipboard.writeText(account.id);
    toast.success('Account ID copied to clipboard');
  };

  useEffect(() => {
    // Close mobile menu when location changes
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobileMenuOpen(false);
  }, [location.pathname]); // Only depend on pathname, not the state itself

  const handleLogout = () => {
    clearToken();
    navigate('/login');
  };

  const getPageTitle = (path) => {
    switch (path) {
      case '/transfer': return 'Transaction Terminal';
      case '/ledger': return 'Ledger Registry';
      case '/analytics': return 'Security Analytics';
      case '/dashboard': return 'Operations Dashboard';
      case '/ops': return 'Operations Hub';
      case '/chaos': return 'Chaos Simulator';
      case '/tools': return 'Developer Tools';
      case '/developers': return 'Developer Portal';
      case '/credit': return 'Credit Hub';
      case '/docs': return 'API Documentation';
      default: return 'Sentinel Manager';
    }
  };

  return (
    <div className="h-screen w-full overflow-hidden flex bg-white dark:bg-[#08090A] text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      
      {/* Mobile Menu Toggle */}
      <button 
        className="lg:hidden fixed top-3 left-4 z-50 p-2 bg-white dark:bg-[#121315] rounded-md border border-zinc-200 dark:border-white/10 shadow-sm"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        <span className="material-symbols-outlined text-sm">{isMobileMenuOpen ? 'close' : 'menu'}</span>
      </button>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden transition-opacity" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* FIXED SIDEBAR */}
      <aside className={`
        fixed left-0 top-0 h-full w-64 border-r border-zinc-200 dark:border-white/10 
        bg-zinc-50 dark:bg-[#121315] flex flex-col z-50 transition-transform duration-300 ease-in-out shrink-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} lg:relative
      `}>
        {/* LOGO Link */}
        <Link to="/" className="px-6 py-5 border-b border-zinc-200 dark:border-white/10 flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-6 h-6 bg-white dark:bg-white rounded-[4px] flex items-center justify-center shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-black text-[14px]">security</span>
          </div>
          <div className="flex flex-col tracking-tight min-w-0">
            <span className="text-[15px] font-black text-black dark:text-white leading-tight truncate">SentinelClear</span>
          </div>
        </Link>

        {/* Dynamic Route Rendering */}
        <nav className="flex-1 px-4 mt-8 overflow-y-auto space-y-1 hide-scrollbar pb-10">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 px-4 mb-4">Platform</p>
          {getNavForRole(getRoleFromToken()).map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            const isDanger = item.name.includes('Chaos');
            return (
              <Link key={item.name} to={item.href}
                className={`
                  flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all relative overflow-hidden group
                  ${isActive 
                    ? `bg-zinc-200 dark:bg-white/5 ${isDanger ? 'text-red-500' : 'text-black dark:text-white'} shadow-sm` 
                    : `text-zinc-500 ${isDanger ? 'hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/5' : 'hover:text-black dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-white/[0.03]'}`}
                `}
              >
                <span className="material-symbols-outlined text-[18px] shrink-0 opacity-70" data-icon={item.icon}>{item.icon}</span>
                <span className="truncate flex-1">{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* MY ACCOUNT ID (Shared Identity) */}
        {account && (
          <div className="mx-4 mb-4 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl space-y-1.5 shrink-0 overflow-hidden shadow-sm">
             <div className="flex justify-between items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500/60 font-mono truncate">My Identity</span>
                <button onClick={copyAccountId} className="material-symbols-outlined text-[14px] text-indigo-500 hover:scale-110 transition-transform shrink-0">content_copy</button>
             </div>
             <p className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 truncate tracking-tight" title={account.id}>{account.id}</p>
          </div>
        )}

        {/* BOTTOM SETTINGS */}
        <div className="p-4 border-t border-zinc-200 dark:border-white/5 space-y-1 shrink-0 bg-zinc-50 dark:bg-[#121315]">
          <button 
            onClick={toggleTheme} 
            className="flex justify-between items-center w-full px-4 py-2 text-zinc-500 hover:text-black dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-white/5 rounded-xl text-[12px] font-bold transition-all"
          >
            <div className="flex items-center gap-3 w-full">
              <span className="material-symbols-outlined text-[18px] shrink-0 opacity-70">{isDark ? 'light_mode' : 'dark_mode'}</span>
              <span>Toggle Theme</span>
            </div>
          </button>

          <button 
            onClick={handleLogout} 
            className="flex items-center w-full gap-3 px-4 py-2 text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/5 rounded-xl text-[12px] font-bold transition-all"
          >
            <span className="material-symbols-outlined text-[18px] shrink-0 opacity-70">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* CORE WORKSPACE WRAPPER */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative isolate bg-white dark:bg-[#08090A]">
        
        <header className="shrink-0 flex justify-between items-center px-10 h-16 w-full bg-white/70 dark:bg-[#08090A]/70 backdrop-blur-md border-b border-zinc-200 dark:border-white/5 z-30">
          <div className="lg:pl-0 pl-10 flex items-center min-w-0">
            <h1 className="text-[13px] font-black uppercase tracking-[0.15em] text-zinc-400 truncate hidden sm:block">
              {getPageTitle(location.pathname)}
            </h1>
          </div>
          
          <div className="flex items-center gap-6 shrink-0">
             <div className="flex items-center gap-2 border border-zinc-200 dark:border-white/5 rounded-full px-3 py-1 bg-zinc-50 dark:bg-white/5 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> 
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest hidden sm:inline">Active Session</span>
             </div>
             <button
               type="button"
               aria-label="Open notifications"
               className="material-symbols-outlined text-zinc-400 hover:text-black dark:hover:text-white text-[20px] transition-colors"
             >
               notifications
             </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto w-full p-6 md:p-10 relative">
           <Outlet />
        </main>

      </div>
    </div>
  );
}
