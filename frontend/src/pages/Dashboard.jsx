import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import apiClient from '../lib/axios';
import { toast } from 'sonner';
import { formatINR } from '../lib/format';
import { useMinLoadingTime } from '../lib/useMinLoadingTime';
import { Skeleton } from '../components/ui/Skeleton';

const parseAmount = (val) => {
  if (val === undefined || val === null) return 0;
  const cleaned = String(val).replace(/[^0-9.-]+/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

export function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [account, setAccount] = useState(null);
  const [history, setHistory] = useState([]);
  const [balanceTimeline, setBalanceTimeline] = useState([]);
  const [incomeExpenseData, setIncomeExpenseData] = useState([]);
  const [personalStats, setPersonalStats] = useState({ sent: 0, received: 0, count: 0 });
  const [isLinkBankOpen, setIsLinkBankOpen] = useState(false);

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

        const sent = historyData
          .filter(tx => tx.sender_account_id === currentUser.id && tx.status === 'COMPLETED')
          .reduce((sum, tx) => sum + parseAmount(tx.amount), 0);
        
        const received = historyData
          .filter(tx => tx.receiver_account_id === currentUser.id && tx.status === 'COMPLETED')
          .reduce((sum, tx) => sum + parseAmount(tx.amount), 0);

        setPersonalStats({ sent, received, count: historyData.length });

        const completedTxns = historyData
          .filter(tx => tx.status === 'COMPLETED')
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const currentBalance = parseAmount(currentUser.balance);
        const timeline = [];
        let runningBalance = currentBalance;

        timeline.push({
          date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
          balance: runningBalance,
          rawDate: new Date(),
        });

        for (const tx of completedTxns) {
          if (tx.sender_account_id === currentUser.id) {
            runningBalance += parseAmount(tx.amount);
          } else if (tx.receiver_account_id === currentUser.id) {
            runningBalance -= parseAmount(tx.amount);
          }

          timeline.push({
            date: new Date(tx.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
            balance: Math.max(0, runningBalance),
            rawDate: new Date(tx.created_at),
          });
        }

        timeline.reverse();

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
                dayMap[label].income += parseAmount(tx.amount);
              }
              if (tx.sender_account_id === currentUser.id) {
                dayMap[label].expenses += parseAmount(tx.amount);
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
  



  const KPIBlock = ({ label, val, rawValue, icon, meta, color, isLoading: kpiLoading, isCurrency = false }) => {
    const [isDetailed, setIsDetailed] = useState(false);
    const toggleDetailed = () => { if (isCurrency) setIsDetailed(!isDetailed); };

    return (
      <div 
        onClick={toggleDetailed}
        className={`bg-white border border-[#e3e8ee] rounded shadow-[0_2px_5px_rgba(0,0,0,0.02)] p-5 hover:shadow-[0_5px_15px_rgba(0,0,0,0.05)] transition-all flex flex-col justify-between overflow-hidden ${isCurrency ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex justify-between items-start mb-4">
          <span className="text-[11px] uppercase font-bold tracking-wider text-[#6B7C93] truncate mr-2">{label}</span>
          <span className={`material-symbols-outlined text-[20px] ${color} opacity-70`}>{icon}</span>
        </div>
        <div className="space-y-1 min-w-0 mt-4">
          <h3 className={`text-[28px] font-light tracking-tight ${color === 'text-[#635BFF]' ? 'text-[#0A2540]' : color} truncate`} title={rawValue}>
            {kpiLoading ? <span className="h-8 block w-24 bg-[#f6f9fc] animate-pulse rounded"></span> : (isDetailed && isCurrency ? formatINR(rawValue, true) : val)}
          </h3>
          <p className="text-[12px] font-medium text-[#6B7C93] truncate">
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
    <div className="max-w-screen-2xl mx-auto space-y-6 md:space-y-8 pb-20 fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full ${error ? 'bg-[#ff6118]' : 'bg-[#0CBF4C]'}`}></span>
            <span className={`text-[11px] font-bold uppercase tracking-wider ${error ? 'text-[#ff6118]' : 'text-[#0CBF4C]'}`}>
              {error ? 'Partial Connectivity' : 'System Online'}
            </span>
          </div>
          <h1 className="text-[28px] md:text-[36px] font-light tracking-tight text-[#0A2540] m-0">Account Dashboard</h1>
          <p className="text-[14px] text-[#425466] mt-2 font-medium">
            Manage your ledger, monitor transaction integrity, and overview liquidity.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setIsLinkBankOpen(true)}
            className="px-5 py-2.5 bg-white border border-[#e3e8ee] hover:bg-[#f6f9fc] text-[#0A2540] font-medium rounded text-[14px] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)] active:scale-95 flex items-center gap-2 min-h-[44px]"
          >
            <span className="material-symbols-outlined text-[18px]">account_balance</span> Link Bank Account
          </button>
          <button
            onClick={() => navigate('/app/transfer')}
            className="px-5 py-2.5 bg-[#635BFF] hover:bg-[#5851db] text-white font-medium rounded text-[14px] transition-all hover:opacity-90 shadow-[0_2px_5px_rgba(99,91,255,0.3)] active:scale-95 flex items-center gap-2 min-h-[44px]"
          >
            <span className="material-symbols-outlined text-[18px]">swap_horiz</span> Transfer
          </button>
        </div>
      </div>

      {/* Link Bank Account Modal */}
      {isLinkBankOpen && (
        <div className="fixed inset-0 bg-[#0A2540]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-[#e3e8ee] rounded-[16px] p-6 md:p-8 max-w-md w-full shadow-[0_8px_30px_rgba(0,0,0,0.12)] space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[10px] bg-[#635BFF]/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[#635BFF] text-[24px]">account_balance</span>
              </div>
              <div>
                <h3 className="text-[18px] font-semibold text-[#0A2540]">Link Bank Account</h3>
                <p className="text-[12px] text-[#6B7C93] mt-0.5">Secure IMPS / NEFT Integration</p>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { icon: 'fingerprint', label: 'Bank Account Number + IFSC', desc: 'Your account details are verified via RBI-approved penny-drop.' },
                { icon: 'shield_locked', label: 'AES-256 Encrypted Storage', desc: 'Credentials are tokenised and never stored in plain text.' },
                { icon: 'speed', label: 'Instant Transfers via IMPS', desc: 'Once linked, funds settle within seconds, 24×7.' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-[#f6f9fc] border border-[#e3e8ee] rounded-[8px]">
                  <span className="material-symbols-outlined text-[#635BFF] text-[20px] shrink-0">{item.icon}</span>
                  <div>
                    <p className="text-[13px] font-semibold text-[#0A2540]">{item.label}</p>
                    <p className="text-[12px] text-[#6B7C93] mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => setIsLinkBankOpen(false)}
              className="w-full py-3 bg-[#0A2540] hover:bg-[#112F4E] text-white font-medium rounded-[8px] text-[14px] transition-all">
              Got It
            </button>
          </div>
        </div>
      )}

      {error && !account && (
        <div className="p-8 border border-[#ffcdcd] bg-[#fff5f5] rounded-[12px] flex flex-col items-center justify-center text-center space-y-4">
           <span className="material-symbols-outlined text-[#df1b41] text-[40px]">cloud_off</span>
           <div className="space-y-1">
             <h3 className="font-medium text-[16px] text-[#df1b41]">{error}</h3>
             <p className="text-[14px] text-[#df1b41]/80">Please check your internet connection or try again later.</p>
           </div>
           <button onClick={() => window.location.reload()} className="px-5 py-2.5 bg-[#df1b41] text-white font-medium rounded text-[14px] hover:bg-[#c91839] transition-all">Retry Connection</button>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <KPIBlock
          label="Available Balance"
          val={formatINR(account?.balance || 100000)}
          rawValue={account?.balance || 100000}
          icon="account_balance_wallet"
          meta={account?.account_type || 'Settlement Account'}
          color="text-[#635BFF]"
          isLoading={loading && !account}
          isCurrency={true}
        />
        <KPIBlock
          label="Total Money Sent"
          val={formatINR(personalStats.sent)}
          rawValue={personalStats.sent}
          icon="arrow_outward"
          meta="Completed Outflows"
          color="text-[#0A2540]"
          isLoading={loading && !account}
          isCurrency={true}
        />
        <KPIBlock
          label="Total Money Received"
          val={formatINR(personalStats.received)}
          rawValue={personalStats.received}
          icon="arrow_downward"
          meta="Completed Inflows"
          color="text-[#0CBF4C]"
          isLoading={loading && !account}
          isCurrency={true}
        />
        <KPIBlock
          label="Recent Transfers"
          val={personalStats.count}
          rawValue={personalStats.count}
          icon="receipt_long"
          meta="Network Interactions"
          color="text-[#425466]"
          isLoading={loading && !account}
          isCurrency={false}
        />
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 md:gap-8">

        {/* Balance Curve */}
        <div className="lg:col-span-3 bg-white border border-[#e3e8ee] rounded-[12px] p-6 shadow-[0_2px_5px_rgba(0,0,0,0.02)] overflow-hidden">
           <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-medium text-[16px] text-[#0A2540]">Ledger Balances</h3>
                <p className="text-[13px] text-[#6B7C93] mt-1">Reconstructed from historical activities.</p>
              </div>
           </div>
           <div className="w-full h-[320px] min-h-[320px] relative">
              {!balanceTimeline.length && !loading ? (
                <div className="h-full flex flex-col items-center justify-center border border-dashed border-[#e3e8ee] bg-[#f6f9fc] rounded">
                   <span className="material-symbols-outlined text-[24px] text-[#6B7C93] mb-2">blur_off</span>
                   <p className="text-[12px] font-medium text-[#6B7C93]">No transactions recorded yet.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320} minWidth={0} minHeight={0}>
                  <AreaChart data={balanceTimeline} margin={{ top: 10, right: 0, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#635BFF" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#635BFF" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3e8ee" />
                    <XAxis dataKey="date" stroke="#6B7C93" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                    <YAxis stroke="#6B7C93" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => formatINR(val)} width={60} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e3e8ee', borderRadius: '8px', fontSize: '13px', color: '#0A2540', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                      formatter={(val) => [formatINR(Number(val), true), 'Balance']}
                    />
                    <Area type="monotone" dataKey="balance" stroke="#635BFF" strokeWidth={2} fillOpacity={1} fill="url(#colorBalance)" activeDot={{ r: 4, fill: '#635BFF', stroke: '#fff', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
           </div>
        </div>

        {/* Income vs Expenses */}
        <div className="lg:col-span-2 bg-white border border-[#e3e8ee] rounded-[12px] p-6 shadow-[0_2px_5px_rgba(0,0,0,0.02)] overflow-hidden">
           <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-medium text-[16px] text-[#0A2540]">Cash Flow (7D)</h3>
                <p className="text-[13px] text-[#6B7C93] mt-1">In vs Out breakdown</p>
              </div>
           </div>
           <div className="w-full h-[320px] min-h-[320px] relative">
              {!history.length && !loading ? (
                <div className="h-full flex flex-col items-center justify-center border border-dashed border-[#e3e8ee] bg-[#f6f9fc] rounded">
                   <span className="material-symbols-outlined text-[24px] text-[#6B7C93] mb-2">bar_chart</span>
                   <p className="text-[12px] font-medium text-[#6B7C93]">Not enough data</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320} minWidth={0} minHeight={0}>
                  <BarChart data={incomeExpenseData} barGap={4} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3e8ee" />
                    <XAxis dataKey="day" stroke="#6B7C93" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                    <YAxis stroke="#6B7C93" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => formatINR(val)} width={50} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e3e8ee', borderRadius: '8px', fontSize: '13px', color: '#0A2540', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                      formatter={(val, name) => [formatINR(Number(val), true), name === 'income' ? 'Income' : 'Expenses']}
                    />
                    <Bar dataKey="income" fill="#0CBF4C" radius={[4, 4, 0, 0]} maxBarSize={20} name="income" />
                    <Bar dataKey="expenses" fill="#ff6118" radius={[4, 4, 0, 0]} maxBarSize={20} name="expenses" />
                  </BarChart>
                </ResponsiveContainer>
              )}
           </div>
           
           <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-[#e3e8ee]">
             <div className="flex items-center gap-2">
               <span className="w-2.5 h-2.5 rounded-sm bg-[#0CBF4C]"></span>
               <span className="text-[12px] font-medium text-[#425466]">Income</span>
             </div>
             <div className="flex items-center gap-2">
               <span className="w-2.5 h-2.5 rounded-sm bg-[#ff6118]"></span>
               <span className="text-[12px] font-medium text-[#425466]">Expenses</span>
             </div>
           </div>
        </div>

      </div>

    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="max-w-screen-2xl mx-auto space-y-6 md:space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-1">
        <div className="space-y-2">
          <Skeleton className="w-20 h-3 rounded" />
          <Skeleton className="w-56 md:w-80 h-10" />
          <Skeleton className="w-40 md:w-64 h-4" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="w-24 h-10 rounded" />
          <Skeleton className="w-28 h-10 rounded" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white border border-[#e3e8ee] rounded-[12px] p-6 shadow-sm h-[140px] flex flex-col justify-between">
             <div className="flex justify-between items-start">
               <Skeleton className="w-24 h-3" />
               <Skeleton className="w-6 h-6 rounded" />
             </div>
             <div className="space-y-2 mt-4">
               <Skeleton className="w-32 h-8" />
               <Skeleton className="w-20 h-3" />
             </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 md:gap-8">
        <div className="lg:col-span-3 bg-white border border-[#e3e8ee] rounded-[12px] p-6 shadow-sm h-[400px] flex flex-col">
           <Skeleton className="flex-1 w-full rounded" />
        </div>
        <div className="lg:col-span-2 bg-white border border-[#e3e8ee] rounded-[12px] p-6 shadow-sm h-[400px] flex flex-col">
           <Skeleton className="flex-1 w-full rounded" />
        </div>
      </div>
    </div>
  );
}
