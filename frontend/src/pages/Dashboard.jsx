import React, { useEffect, useState, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import apiClient from '../lib/axios';
import { toast } from 'sonner';
import { ThemeContext } from '../App';
import { formatINR, getISTHour } from '../lib/format';
import { useMinLoadingTime } from '../lib/useMinLoadingTime';
import { Skeleton } from '../components/ui/Skeleton';

export function Dashboard() {
  const navigate = useNavigate();
  const { isDark } = useContext(ThemeContext);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [account, setAccount] = useState(null);
  const [history, setHistory] = useState([]);
  const [balanceTimeline, setBalanceTimeline] = useState([]);
  const [incomeExpenseData, setIncomeExpenseData] = useState([]);
  const [personalStats, setPersonalStats] = useState({ sent: 0, received: 0, count: 0 });
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [accRes, historyRes] = await Promise.allSettled([
        apiClient.get('/accounts/me'),
        apiClient.get('/transfers/history/all?limit=50')
      ]);

      let currentUser = null;
      if (accRes.status === 'fulfilled') {
        currentUser = accRes.value.data;
        setAccount(currentUser);
      }

      if (historyRes.status === 'fulfilled' && currentUser) {
        const historyData = historyRes.value.data;
        setHistory(historyData);

        // Calculate Personal Stats
        const sent = historyData
          .filter(tx => tx.sender_account_id === currentUser.id && tx.status === 'COMPLETED')
          .reduce((sum, tx) => sum + tx.amount, 0);
        
        const received = historyData
          .filter(tx => tx.receiver_account_id === currentUser.id && tx.status === 'COMPLETED')
          .reduce((sum, tx) => sum + tx.amount, 0);

        setPersonalStats({ sent, received, count: historyData.length });

        // ───────────────────────────────────────────────────
        // BUILD "Account Balance Over Time" (reverse compute)
        // Walk transfers in reverse-chronological order and 
        // reconstruct what the balance was at each transfer.
        // ───────────────────────────────────────────────────
        const completedTxns = historyData
          .filter(tx => tx.status === 'COMPLETED')
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // newest first

        const currentBalance = currentUser.balance || 0;
        const timeline = [];
        let runningBalance = currentBalance;

        // The current moment
        timeline.push({
          date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
          balance: runningBalance,
          rawDate: new Date(),
        });

        for (const tx of completedTxns) {
          // Reverse the transaction to get the balance before it
          if (tx.sender_account_id === currentUser.id) {
            // User sent money → balance was higher before
            runningBalance += tx.amount;
          } else if (tx.receiver_account_id === currentUser.id) {
            // User received money → balance was lower before
            runningBalance -= tx.amount;
          }

          timeline.push({
            date: new Date(tx.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
            balance: Math.max(0, runningBalance),
            rawDate: new Date(tx.created_at),
          });
        }

        // Reverse to chronological order (oldest → newest)
        timeline.reverse();

        // Deduplicate by date label, keeping the last entry for each date
        const deduped = [];
        const seenDates = new Set();
        for (let i = timeline.length - 1; i >= 0; i--) {
          const key = timeline[i].date;
          if (!seenDates.has(key)) {
            seenDates.add(key);
            deduped.unshift(timeline[i]);
          }
        }

        setBalanceTimeline(deduped.length > 1 ? deduped : timeline);

        // ───────────────────────────────────────────────────
        // BUILD "Income vs Expenses" breakdown (last 7 days)
        // ───────────────────────────────────────────────────
        const now = new Date();
        const dayMap = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          const label = d.toLocaleDateString('en-IN', { weekday: 'short' });
          dayMap[label] = { day: label, income: 0, expenses: 0 };
        }

        completedTxns.forEach(tx => {
          const txDate = new Date(tx.created_at);
          const daysDiff = Math.floor((now - txDate) / (1000 * 60 * 60 * 24));
          if (daysDiff <= 6) {
            const label = txDate.toLocaleDateString('en-IN', { weekday: 'short' });
            if (dayMap[label]) {
              if (tx.receiver_account_id === currentUser.id) {
                dayMap[label].income += tx.amount;
              }
              if (tx.sender_account_id === currentUser.id) {
                dayMap[label].expenses += tx.amount;
              }
            }
          }
        });

        setIncomeExpenseData(Object.values(dayMap));
      }

      if (accRes.status === 'rejected' && historyRes.status === 'rejected') {
        setError('Cannot connect to the server. Please check your network or backend status.');
      }

    } catch (err) {
      console.error("Dashboard_Fatal_Error:", err);
      setError('A critical error occurred while loading the dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);
  
  const handleDeposit = async (e) => {
    e.preventDefault();
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast.error("Invalid Amount", { description: "Enter a positive number to deposit." });
      return;
    }

    setIsDepositing(true);
    try {
      await apiClient.post('/accounts/me/deposit', { amount: parseFloat(depositAmount) });
      toast.success("Settlement Complete", {
        description: `₹${parseFloat(depositAmount).toLocaleString()} successfully deposited into your vault.`,
      });
      setIsDepositOpen(false);
      setDepositAmount('');
      fetchDashboardData();
    } catch (err) {
      toast.error("Deposit Failed", { description: err.response?.data?.detail || "Could not finalize settlement." });
    } finally {
      setIsDepositing(false);
    }
  };


  const KPIBlock = ({ label, val, rawValue, icon, meta, color, isLoading: kpiLoading, isCurrency = false }) => {
    const [isDetailed, setIsDetailed] = useState(false);

    const toggleDetailed = () => {
      if (isCurrency) setIsDetailed(!isDetailed);
    };

    return (
      <div 
        onClick={toggleDetailed}
        className={`bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-2xl p-6 shadow-sm group hover:border-indigo-500/20 transition-all flex flex-col justify-between overflow-hidden ${isCurrency ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex justify-between items-start mb-6">
          <span className="text-[10px] uppercase font-black tracking-widest text-zinc-400 dark:text-zinc-500 truncate mr-2">{label}</span>
          <span className={`material-symbols-outlined ${color} opacity-40 group-hover:opacity-100 transition-opacity shrink-0`}>{icon}</span>
        </div>
        <div className="space-y-1 min-w-0">
          <h3 className={`text-2xl md:text-3xl font-black tracking-tight ${color} truncate animate-in duration-300 fade-in slide-in-from-left-1`} title={rawValue}>
            {kpiLoading ? <span className="h-8 block w-24 bg-zinc-100 dark:bg-white/5 animate-pulse rounded"></span> : (isDetailed && isCurrency ? formatINR(rawValue, true) : val)}
          </h3>
          <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-600 uppercase tracking-widest truncate">
            {isDetailed && isCurrency ? 'Precise Balance' : (meta || '—')}
          </p>
        </div>
      </div>
    );
  };

  const showSkeleton = useMinLoadingTime(loading && !account && !error, 1200);

  if (showSkeleton) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="max-w-screen-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)] ${error ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${error ? 'text-amber-500' : 'text-emerald-500'}`}>
              {error ? 'Partial Connectivity' : 'System Online'}
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-slate-900 dark:text-white">Operations Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-2 max-w-lg leading-relaxed font-medium">
            Manage your ledger, monitor transaction integrity, and adjust fraud protection rules.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsDepositOpen(true)}
            className="px-6 py-2.5 border border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-white/5 text-slate-900 dark:text-white font-bold rounded-xl text-sm transition-all shadow-sm active:scale-95 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add_card</span> Deposit
          </button>
          <button
            onClick={() => navigate('/transfer')}
            className="px-6 py-2.5 bg-indigo-600 dark:bg-white text-white dark:text-black font-bold rounded-xl text-sm transition-all hover:opacity-90 shadow-lg active:scale-95 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span> New Transfer
          </button>
        </div>
      </div>

      {isDepositOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/10 rounded-3xl w-full max-w-md p-8 shadow-2xl space-y-6 animate-in zoom-in-95 slide-in-from-bottom-5 duration-300">
              <div className="flex justify-between items-start">
                 <div>
                    <h3 className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white">Deposit Funds</h3>
                    <p className="text-xs text-zinc-500 font-medium">Add liquidity to your primary Sentinel vault.</p>
                 </div>
                 <button onClick={() => setIsDepositOpen(false)} className="text-zinc-400 hover:text-white transition-colors">
                    <span className="material-symbols-outlined">close</span>
                 </button>
              </div>

              <form onSubmit={handleDeposit} className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Amount (INR)</label>
                    <div className="relative">
                       <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">₹</span>
                       <input 
                         autoFocus
                         type="number" 
                         step="0.01"
                         value={depositAmount}
                         onChange={e => setDepositAmount(e.target.value)}
                         placeholder="0.00"
                         className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-2xl pl-8 pr-4 py-4 text-xl font-black outline-none focus:border-indigo-500/50 transition-all text-slate-900 dark:text-white"
                       />
                    </div>
                 </div>

                 <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-4">
                    <div className="flex gap-3 text-indigo-500 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                       <span className="material-symbols-outlined text-[16px]">info</span>
                       <span>Deposits are processed through the internal settlement network with real-time audit hashing.</span>
                    </div>
                 </div>

                 <button 
                   type="submit"
                   disabled={isDepositing || !depositAmount}
                   className="w-full py-4 bg-indigo-600 dark:bg-white text-white dark:text-black font-black rounded-xl text-xs uppercase tracking-widest shadow-xl transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                 >
                   {isDepositing ? 'Processing Settlement...' : 'Finalize Deposit'}
                 </button>
              </form>
           </div>
        </div>
      )}

      {error && !account && (
        <div className="p-10 border border-amber-500/20 bg-amber-500/5 rounded-[32px] flex flex-col items-center justify-center text-center space-y-4">
           <span className="material-symbols-outlined text-amber-500 text-5xl">cloud_off</span>
           <div className="space-y-1">
             <h3 className="font-black text-xl text-slate-900 dark:text-white">{error}</h3>
             <p className="text-sm text-zinc-500 font-medium">Please check your internet connection or try again later.</p>
           </div>
           <button onClick={() => window.location.reload()} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow-lg hover:bg-indigo-700 transition-all">Retry Connection</button>
        </div>
      )}

      {/* KPI Grid - Personal Account Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPIBlock
          label="Available Balance"
          val={formatINR(account?.balance || 0)}
          rawValue={account?.balance || 0}
          icon="account_balance_wallet"
          meta={account?.account_type || 'Ledger Account'}
          color="text-slate-900 dark:text-white"
          isLoading={loading && !account}
          isCurrency={true}
        />
        <KPIBlock
          label="Total Money Sent"
          val={formatINR(personalStats.sent)}
          rawValue={personalStats.sent}
          icon="arrow_outward"
          meta="Completed Outflows"
          color="text-amber-600 dark:text-amber-500"
          isLoading={loading && !account}
          isCurrency={true}
        />
        <KPIBlock
          label="Total Money Received"
          val={formatINR(personalStats.received)}
          rawValue={personalStats.received}
          icon="arrow_downward"
          meta="Completed Inflows"
          color="text-emerald-600 dark:text-emerald-500"
          isLoading={loading && !account}
          isCurrency={true}
        />
        <KPIBlock
          label="Recent Transfers"
          val={personalStats.count}
          rawValue={personalStats.count}
          icon="receipt_long"
          meta="Network Interactions"
          color="text-indigo-500"
          isLoading={loading && !account}
          isCurrency={false}
        />
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

        {/* Balance Over Time — Primary Chart */}
        <div className="lg:col-span-3 bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-3xl p-8 shadow-sm overflow-hidden">
           <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Account Balance Over Time</h3>
                <p className="text-xs text-zinc-500 font-medium">Reconstructed from your completed transfer history</p>
              </div>
              <div className="px-3 py-1 bg-zinc-100 dark:bg-white/5 rounded-full text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-white/5">Balance Log</div>
           </div>
           <div className="w-full h-[400px] relative">
              {!balanceTimeline.length && !loading ? (
                <div className="h-full flex items-center justify-center border-2 border-dashed border-zinc-100 dark:border-white/5 rounded-2xl">
                   <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">No activity detected</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={1}>
                  <AreaChart data={balanceTimeline}>
                    <defs>
                      <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)"} />
                    <XAxis dataKey="date" stroke={isDark ? "#52525b" : "#a1a1aa"} fontSize={10} tickLine={false} axisLine={false} dy={10} />
                    <YAxis stroke={isDark ? "#52525b" : "#a1a1aa"} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => formatINR(val)} width={80} />
                    <Tooltip
                      contentStyle={{ backgroundColor: isDark ? '#121315' : '#fff', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '12px', fontSize: '11px', color: isDark ? '#fff' : '#000' }}
                      formatter={(val) => [formatINR(Number(val), true), 'Balance']}
                    />
                    <Area type="monotone" dataKey="balance" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#colorBalance)" activeDot={{ r: 4, fill: '#818cf8', stroke: '#fff', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
           </div>
        </div>

        {/* Income vs Expenses — Secondary Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-3xl p-8 shadow-sm overflow-hidden">
           <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Income vs Expenses</h3>
                <p className="text-xs text-zinc-500 font-medium">Last 7 days breakdown</p>
              </div>
              <div className="px-3 py-1 bg-emerald-50 dark:bg-emerald-500/5 rounded-full text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/10">Weekly</div>
           </div>
           <div className="w-full h-[400px] relative">
              {!history.length && !loading ? (
                <div className="h-full flex items-center justify-center border-2 border-dashed border-zinc-100 dark:border-white/5 rounded-2xl">
                   <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">No data yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={1}>
                  <BarChart data={incomeExpenseData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)"} />
                    <XAxis dataKey="day" stroke={isDark ? "#52525b" : "#a1a1aa"} fontSize={10} tickLine={false} axisLine={false} dy={10} />
                    <YAxis stroke={isDark ? "#52525b" : "#a1a1aa"} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => formatINR(val)} width={65} />
                    <Tooltip
                      contentStyle={{ backgroundColor: isDark ? '#121315' : '#fff', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '12px', fontSize: '11px', color: isDark ? '#fff' : '#000' }}
                      formatter={(val, name) => [formatINR(Number(val), true), name === 'income' ? 'Income' : 'Expenses']}
                    />
                    <Bar dataKey="income" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={24} name="income" />
                    <Bar dataKey="expenses" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={24} name="expenses" />
                  </BarChart>
                </ResponsiveContainer>
              )}
           </div>

           {/* Legend */}
           <div className="flex items-center justify-center gap-6 mt-4">
             <div className="flex items-center gap-2">
               <span className="w-3 h-3 rounded-sm bg-emerald-500"></span>
               <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Income</span>
             </div>
             <div className="flex items-center gap-2">
               <span className="w-3 h-3 rounded-sm bg-amber-500"></span>
               <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Expenses</span>
             </div>
           </div>
        </div>

      </div>

    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="max-w-screen-2xl mx-auto space-y-8 pb-20">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
        <div className="space-y-3">
          <Skeleton className="w-24 h-4 rounded-full" />
          <Skeleton className="w-64 md:w-96 h-10 md:h-12" />
          <Skeleton className="w-48 md:w-80 h-4" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="w-40 h-10 rounded-xl" />
          <Skeleton className="w-40 h-10 rounded-xl" />
        </div>
      </div>

      {/* 4 KPI Skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-2xl p-6 shadow-sm h-36 flex flex-col justify-between">
             <div className="flex justify-between items-start mb-6">
               <Skeleton className="w-24 h-3" />
               <Skeleton className="w-6 h-6 rounded-md" />
             </div>
             <div className="space-y-2">
               <Skeleton className="w-3/4 h-8" />
               <Skeleton className="w-1/2 h-3" />
             </div>
          </div>
        ))}
      </div>

      {/* Chart Skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-3xl p-8 shadow-sm h-[500px] flex flex-col">
           <div className="flex justify-between items-start mb-8">
              <div className="space-y-2">
                 <Skeleton className="w-40 h-5" />
                 <Skeleton className="w-64 h-3" />
              </div>
              <Skeleton className="w-20 h-6 rounded-full" />
           </div>
           <Skeleton className="flex-1 w-full rounded-xl" />
        </div>
        <div className="lg:col-span-2 bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-3xl p-8 shadow-sm h-[500px] flex flex-col">
           <div className="flex justify-between items-start mb-8">
              <div className="space-y-2">
                 <Skeleton className="w-32 h-5" />
                 <Skeleton className="w-48 h-3" />
              </div>
              <Skeleton className="w-16 h-6 rounded-full" />
           </div>
           <Skeleton className="flex-1 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
