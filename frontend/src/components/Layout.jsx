import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { clearToken, getRoleFromToken } from '../lib/auth';
import apiClient from '../lib/axios';
import { toast } from 'sonner';

const getNavForRole = (role) => {
  const common = [];

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
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

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
      default: return 'Sentinel Manager';
    }
  };

  return (
    <div className="h-screen w-full overflow-hidden flex bg-[#ffffff] text-[#425466]">
      
      {/* Mobile Menu Toggle - Stripe Style */}
      <button 
        className="lg:hidden fixed top-3 left-4 z-50 p-2 bg-white rounded border border-[#e3e8ee] shadow-sm text-[#0A2540]"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label="Toggle menu"
      >
        <span className="material-symbols-outlined text-sm">{isMobileMenuOpen ? 'close' : 'menu'}</span>
      </button>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-[#0A2540]/20 backdrop-blur-sm z-40 lg:hidden transition-opacity" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* FIXED SIDEBAR */}
      <aside className={`
        fixed left-0 top-0 h-full w-[240px] border-r border-[#e3e8ee] 
        bg-white flex flex-col z-50 transition-transform duration-300 ease-in-out shrink-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} lg:relative
      `}>
        {/* LOGO Link */}
        <Link to="/" className="px-5 py-4 flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-6 h-6 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[#635BFF] text-[20px]">security</span>
          </div>
          <span className="text-[15px] font-medium text-[#0A2540] tracking-tight truncate">SentinelClear</span>
        </Link>

        {/* Dynamic Route Rendering */}
        <nav className="flex-1 px-3 mt-4 overflow-y-auto space-y-1 hide-scrollbar pb-10">
          <p className="text-[11px] font-semibold text-[#6B7C93] px-3 mb-2 mt-4 uppercase tracking-wider">Application</p>
          {getNavForRole(getRoleFromToken()).map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            const isDanger = item.name.includes('Chaos');
            return (
              <Link key={item.name} to={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded text-[13px] font-medium transition-colors relative group
                  ${isActive 
                    ? `bg-[#f6f9fc] text-[#0A2540] shadow-sm shadow-[#0A2540]/5` 
                    : `text-[#6B7C93] ${isDanger ? 'hover:text-[#df1b41] hover:bg-[#fff5f5]' : 'hover:text-[#0A2540] hover:bg-[#f6f9fc]'}`}
                `}
              >
                {/* Active Indicator Bar */}
                {isActive && <div className="absolute left-0 top-1 bottom-1 w-[3px] bg-[#635BFF] rounded-r-md"></div>}
                
                <span className={`material-symbols-outlined text-[18px] shrink-0 ${isActive ? 'text-[#635BFF]' : 'text-[#a3b1c6]'}`} data-icon={item.icon}>{item.icon}</span>
                <span className="truncate flex-1">{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* MY ACCOUNT ID */}
        {account && (
          <div className="mx-4 mb-4 p-3 bg-[#f6f9fc] border border-[#e3e8ee] rounded shadow-sm shrink-0 overflow-hidden group">
             <div className="flex justify-between items-center gap-2 mb-1">
                <span className="text-[10px] font-bold text-[#6B7C93] uppercase tracking-wider truncate">My Identity</span>
                <button onClick={copyAccountId} className="material-symbols-outlined text-[14px] text-[#635BFF] opacity-0 group-hover:opacity-100 transition-opacity">content_copy</button>
             </div>
             <p className="text-[11px] font-mono text-[#0A2540] truncate bg-white border border-[#e3e8ee] p-1.5 rounded text-center">{account.id.substring(0, 16)}...</p>
          </div>
        )}

        {/* BOTTOM SETTINGS */}
        <div className="p-4 border-t border-[#e3e8ee] space-y-1 shrink-0 bg-white">
          <button 
            onClick={handleLogout} 
            className="flex items-center w-full gap-3 px-3 py-2 text-[#6B7C93] hover:text-[#df1b41] hover:bg-[#fff5f5] rounded text-[13px] font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-[18px] shrink-0 text-[#a3b1c6]">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* CORE WORKSPACE WRAPPER */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#f6f9fc]">
        
        <header className="shrink-0 flex justify-between items-center px-6 lg:px-10 h-16 w-full bg-white border-b border-[#e3e8ee] z-30 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="lg:pl-0 pl-10 flex items-center min-w-0">
            <h1 className="text-[15px] font-medium text-[#0A2540] truncate hidden sm:block">
              {getPageTitle(location.pathname)}
            </h1>
          </div>
          
          <div className="flex items-center gap-4 shrink-0">
             <div className="flex items-center gap-2 border border-[#e3e8ee] rounded-full px-3 py-1 bg-[#ffffff] shadow-[0_1px_2px_rgba(0,0,0,0.02)] hidden sm:flex">
                <span className="w-2 h-2 rounded-full bg-[#0CBF4C]"></span> 
                <span className="text-[11px] font-medium text-[#425466]">Production Mode</span>
             </div>

             {/* Notification Bell */}
             <div className="relative" ref={notifRef}>
               <button
                 onClick={toggleNotifPanel}
                 className={`relative w-8 h-8 rounded border transition-colors flex items-center justify-center ${isNotifOpen ? 'bg-[#f6f9fc] border-[#e3e8ee] shadow-inner' : 'bg-white border-[#e3e8ee] hover:bg-[#f6f9fc]'}`}
               >
                 <span className="material-symbols-outlined text-[#425466] text-[18px]">notifications</span>
                 {notifCount > 0 && (
                   <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#df1b41] text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                     {notifCount > 9 ? '9+' : notifCount}
                   </span>
                 )}
               </button>

               {isNotifOpen && (
                 <div className="absolute top-10 right-0 w-80 bg-white border border-[#e3e8ee] rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.12)] z-50 overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200">
                   <div className="p-3 border-b border-[#e3e8ee] bg-[#f6f9fc] flex items-center justify-between">
                     <p className="text-[13px] font-semibold text-[#0A2540]">Notifications</p>
                     <div className="flex items-center gap-3">
                       {notifications.length > 0 && (
                         <button onClick={clearAllNotifications} className="text-[11px] font-medium text-[#6B7C93] hover:text-[#0A2540]">
                           Clear All
                         </button>
                       )}
                     </div>
                   </div>
                   <div className="max-h-80 overflow-y-auto hide-scrollbar">
                     {notifications.length === 0 ? (
                       <div className="py-8 flex flex-col items-center gap-2 text-[#6B7C93]">
                         <span className="material-symbols-outlined text-2xl opacity-50">done_all</span>
                         <span className="text-[12px] font-medium">You're all caught up</span>
                       </div>
                     ) : (
                       notifications.map((n, i) => (
                         <div key={n.id || i} className="px-4 py-3 border-b border-[#e3e8ee] hover:bg-[#f6f9fc] transition-colors cursor-default">
                           <div className="flex items-start gap-3">
                             <span className={`material-symbols-outlined text-[16px] mt-0.5 shrink-0 ${
                               n.event_type?.includes('FLAGGED') || n.event_type?.includes('BLOCKED') ? 'text-[#df1b41]' :
                               n.event_type?.includes('COMPLETED') ? 'text-[#0CBF4C]' : 'text-[#635BFF]'
                             }`}>
                               {n.event_type?.includes('FLAGGED') || n.event_type?.includes('BLOCKED') ? 'error' :
                                n.event_type?.includes('COMPLETED') ? 'check_circle' : 'info'}
                             </span>
                             <div className="min-w-0 flex-1">
                               <p className="text-[13px] font-medium text-[#0A2540] truncate">{n.message || n.event_type || 'Event'}</p>
                               <p className="text-[11px] text-[#6B7C93] mt-0.5">
                                 {n.created_at ? new Date(n.created_at).toLocaleString('en-IN') : 'Just now'}
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
                   className={`w-8 h-8 rounded border transition-colors flex items-center justify-center ${isProfileMenuOpen ? 'bg-[#f6f9fc] border-[#e3e8ee] shadow-inner' : 'bg-white border-[#e3e8ee] hover:bg-[#f6f9fc]'}`}
                 >
                   <span className="material-symbols-outlined text-[#425466] text-[18px]">person</span>
                 </button>
                 
                 {isProfileMenuOpen && (
                     <div className="absolute top-10 right-0 w-64 bg-white border border-[#e3e8ee] rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.12)] z-50 overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200">
                        <div className="p-4 border-b border-[#e3e8ee] bg-[#f6f9fc]">
                            <p className="text-[14px] font-semibold text-[#0A2540] truncate">{profile?.full_name || 'My Account'}</p>
                            <p className="text-[12px] text-[#425466] truncate mt-0.5">{profile?.email || ''}</p>
                            
                            {profile && !profile.profile_complete && (
                              <Link to="/app/profile-setup" onClick={() => setIsProfileMenuOpen(false)}
                                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#df1b41]/10 text-[#df1b41] rounded text-[11px] font-medium hover:bg-[#df1b41]/20 transition-all">
                                <span className="material-symbols-outlined text-[14px]">warning</span> Complete Setup
                              </Link>
                            )}
                        </div>
                        <div className="p-2 flex flex-col gap-1">
                            <Link to="/app/account" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded text-[13px] font-medium text-[#425466] hover:bg-[#f6f9fc] hover:text-[#0A2540] transition-colors">
                                <span className="material-symbols-outlined text-[16px] text-[#6B7C93]">manage_accounts</span>
                                Account Settings
                            </Link>
                            <Link to="/app/upi-safety" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded text-[13px] font-medium text-[#425466] hover:bg-[#f6f9fc] hover:text-[#0A2540] transition-colors">
                                <span className="material-symbols-outlined text-[16px] text-[#6B7C93]">shield</span>
                                UPI Safety Center
                            </Link>
                            <div className="w-full h-px bg-[#e3e8ee] my-1"></div>
                            <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 rounded text-[13px] font-medium text-[#425466] hover:bg-[#fff5f5] hover:text-[#df1b41] transition-colors w-full text-left">
                                <span className="material-symbols-outlined text-[16px] text-[#6B7C93] group-hover:text-[#df1b41]">logout</span>
                                Sign Out
                            </button>
                        </div>
                     </div>
                 )}
             </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto w-full p-4 sm:p-6 lg:p-8 relative">
           <Outlet />
        </main>
      </div>
    </div>
  );
}
