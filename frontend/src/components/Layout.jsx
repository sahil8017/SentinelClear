import React, { useState, useEffect, useContext, useRef } from 'react';
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
      { name: 'Maker/Checker Queue', href: '/admin/maker-checker', icon: 'fact_check' },
      { name: 'Security Analytics', href: '/admin/analytics', icon: 'shield_locked' },
      { name: 'Chaos Simulator', href: '/admin/chaos', icon: 'warning' },
      { name: 'AML Intelligence', href: '/admin/aml-graph', icon: 'account_tree' },
      { name: 'EOD Cryptographic Audit', href: '/admin/audit', icon: 'enhanced_encryption' },
      { name: 'Developer Tools', href: '/admin/tools', icon: 'terminal' },
      ...common
    ];
  }

  return [
    { name: 'Dashboard', href: '/app/dashboard', icon: 'dashboard' },
    { name: 'Transfers', href: '/app/transfer', icon: 'payments' },
    { name: 'Ledger Registry', href: '/app/ledger', icon: 'menu_book' },
    { name: 'Credit Hub', href: '/app/credit', icon: 'account_balance' },
    { name: 'UPI Safety', href: '/app/upi-safety', icon: 'shield' },

    ...common
  ];
};

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isDark, toggleTheme } = useContext(ThemeContext);
  const [account, setAccount] = useState(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [notifCount, setNotifCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const notifRef = useRef(null);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutsideNotif = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideNotif);
    return () => document.removeEventListener('mousedown', handleClickOutsideNotif);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await apiClient.get('/notifications?limit=10');
      setNotifications(res.data || []);
      setNotifCount(res.data?.length || 0);
    } catch {
      setNotifications([]);
    }
  };

  const toggleNotifPanel = () => {
    if (!isNotifOpen) fetchNotifications();
    setIsNotifOpen(!isNotifOpen);
  };

  const clearAllNotifications = async () => {
    try {
      await apiClient.delete('/notifications');
      setNotifications([]);
      setNotifCount(0);
      toast.success('All notifications cleared');
    } catch {
      toast.error('Failed to clear notifications');
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    apiClient.get('/accounts/me')
      .then(res => setAccount(res.data))
      .catch(err => console.error('Account sync failed', err));
    apiClient.get('/auth/profile')
      .then(res => setProfile(res.data))
      .catch(() => {});
    apiClient.get('/notifications?unread=true&limit=1')
      .then(res => setNotifCount(res.data?.length || 0))
      .catch(() => {});
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
      case '/aml-graph': return 'AML Intelligence';
      case '/tools': return 'Developer Tools';

      case '/credit': return 'Credit Hub';
      case '/upi-safety': return 'UPI Safety Hub';
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

             {/* Notification Bell */}
             <div className="relative" ref={notifRef}>
               <button
                 onClick={toggleNotifPanel}
                 className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-colors border shadow-sm outline-none ${isNotifOpen ? 'bg-zinc-200 dark:bg-white/10 border-zinc-300 dark:border-white/20' : 'bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 border-zinc-200 dark:border-white/5'}`}
               >
                 <span className="material-symbols-outlined text-zinc-600 dark:text-zinc-300 text-[20px]">notifications</span>
                 {notifCount > 0 && (
                   <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center shadow-lg">
                     {notifCount > 9 ? '9+' : notifCount}
                   </span>
                 )}
               </button>

               {isNotifOpen && (
                 <div className="absolute top-12 right-0 w-80 bg-white dark:bg-[#121315] border border-zinc-200 dark:border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200">
                   <div className="p-4 border-b border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-white/[0.02] flex items-center justify-between">
                     <p className="text-sm font-black text-zinc-900 dark:text-white">Notifications</p>
                     <div className="flex items-center gap-3">
                       {notifications.length > 0 && (
                         <button onClick={clearAllNotifications} className="text-[10px] font-bold text-red-500 uppercase tracking-widest hover:text-red-400 transition-colors">
                           Clear All
                         </button>
                       )}
                       <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{notifications.length}</span>
                     </div>
                   </div>
                   <div className="max-h-80 overflow-y-auto hide-scrollbar">
                     {notifications.length === 0 ? (
                       <div className="py-10 flex flex-col items-center gap-2 text-zinc-400">
                         <span className="material-symbols-outlined text-3xl opacity-40">notifications_off</span>
                         <span className="text-[11px] font-bold uppercase tracking-widest">No notifications</span>
                       </div>
                     ) : (
                       notifications.map((n, i) => (
                         <div key={n.id || i} className="px-4 py-3 border-b border-zinc-100 dark:border-white/5 hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors">
                           <div className="flex items-start gap-3">
                             <span className={`material-symbols-outlined text-[18px] mt-0.5 shrink-0 ${
                               n.event_type?.includes('FLAGGED') || n.event_type?.includes('BLOCKED') ? 'text-red-500' :
                               n.event_type?.includes('COMPLETED') ? 'text-emerald-500' : 'text-indigo-500'
                             }`}>
                               {n.event_type?.includes('FLAGGED') || n.event_type?.includes('BLOCKED') ? 'gpp_maybe' :
                                n.event_type?.includes('COMPLETED') ? 'check_circle' : 'info'}
                             </span>
                             <div className="min-w-0 flex-1">
                               <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">{n.message || n.event_type || 'Event'}</p>
                               <p className="text-[10px] text-zinc-400 font-medium mt-0.5">
                                 {n.created_at ? new Date(n.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) : ''}
                               </p>
                             </div>
                           </div>
                         </div>
                       ))
                     )}
                   </div>
                 </div>
               )}
             </div>
             
             {/* Profile Menu Wrapper */}
             <div className="relative" ref={profileMenuRef}>
                 <button
                   onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                   className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors border shadow-sm outline-none ${isProfileMenuOpen ? 'bg-zinc-200 dark:bg-white/10 border-zinc-300 dark:border-white/20' : 'bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 border-zinc-200 dark:border-white/5'}`}
                 >
                   <span className="material-symbols-outlined text-zinc-600 dark:text-zinc-300 text-[20px]">person</span>
                 </button>
                 
                 {isProfileMenuOpen && (
                     <div className="absolute top-12 right-0 w-60 bg-white dark:bg-[#121315] border border-zinc-200 dark:border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200">
                        <div className="p-4 border-b border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-white/[0.02]">
                            <p className="text-sm font-black text-zinc-900 dark:text-white truncate">{profile?.full_name || 'My Account'}</p>
                            <p className="text-[10px] text-zinc-500 truncate mt-0.5">{profile?.email || ''}</p>
                            <p className="text-[10px] font-mono text-zinc-400 truncate mt-1">ID: {account?.id || 'Loading...'}</p>
                            {profile && !profile.profile_complete && (
                              <Link to="/app/profile-setup" onClick={() => setIsProfileMenuOpen(false)}
                                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/20 transition-all">
                                <span className="material-symbols-outlined text-[12px]">warning</span> Complete Setup
                              </Link>
                            )}
                        </div>
                        <div className="p-2 flex flex-col gap-1">
                            <Link to="/app/account" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors">
                                <span className="material-symbols-outlined text-[18px]">person</span>
                                Account Profile
                            </Link>
                            <Link to="/app/upi-safety" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors">
                                <span className="material-symbols-outlined text-[18px]">shield</span>
                                UPI Safety
                            </Link>
                            <button onClick={() => { toggleTheme(); setIsProfileMenuOpen(false); }} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors w-full text-left">
                                <span className="material-symbols-outlined text-[18px]">{isDark ? 'light_mode' : 'dark_mode'}</span>
                                Toggle Theme
                            </button>
                            <div className="w-full h-px bg-zinc-100 dark:bg-white/5 my-1"></div>
                            <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors w-full text-left">
                                <span className="material-symbols-outlined text-[18px]">logout</span>
                                Sign Out
                            </button>
                        </div>
                     </div>
                 )}
             </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto w-full p-6 md:p-10 relative">
           <Outlet />
        </main>

      </div>
    </div>
  );
}
