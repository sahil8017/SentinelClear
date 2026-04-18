import React, { useEffect, useState } from 'react';
import apiClient from '../lib/axios';
import { toast } from 'sonner';
import { formatINR, formatIST } from '../lib/format';
import { useMinLoadingTime } from '../lib/useMinLoadingTime';
import { Skeleton } from '../components/ui/Skeleton';
import { getRoleFromToken } from '../lib/auth';

export function Ledger() {
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [integrity, setIntegrity] = useState(null);
  const [fraudStats, setFraudStats] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [account, setAccount] = useState(null);
  const role = getRoleFromToken();
  const isAdmin = role === 'ADMIN';

  useEffect(() => {
    fetchLedgerData();
  }, []);

  const fetchLedgerData = async () => {
    setIsLoading(true);
    try {
      const endpoints = [
        '/transfers/history/all',
        '/accounts/me'
      ];

      if (isAdmin) {
        endpoints.push('/ledger/verify/integrity');
        endpoints.push('/fraud/dashboard');
      }

      const results = await Promise.allSettled(
        endpoints.map(url => apiClient.get(url))
      );

      // Map results back by checking endpoint index or content
      // Since map order is preserved:
      if (results[0].status === 'fulfilled') setTransactions(results[0].value.data);
      if (results[1].status === 'fulfilled') setAccount(results[1].value.data);
      
      if (isAdmin) {
        if (results[2].status === 'fulfilled') setIntegrity(results[2].value.data);
        if (results[3].status === 'fulfilled') setFraudStats(results[3].value.data);
      }
    } catch (err) {
      console.error('Ledger sync failure', err);
      toast.error('Cryptographic sync failed. Reconnecting to vault...');
    } finally {
      setIsLoading(false);
    }
  };

  const showLoading = useMinLoadingTime(isLoading, 1200);

  const handleExport = async () => {
    if (!account) {
      toast.error('No account loaded. Cannot generate statement.');
      return;
    }
    setIsExporting(true);
    try {
      const res = await apiClient.get(`/accounts/${account.id}/statement`, {
        responseType: 'blob',
        params: { days: 30 },
      });

      // Trigger browser file download
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `statement_${account.id.slice(0, 8)}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Statement downloaded successfully');
    } catch (err) {
      console.error('Export failed', err);
      toast.error('Failed to generate PDF statement');
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusBadge = (status) => {
    const base = "inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border transition-all duration-300";
    if (status === 'COMPLETED') {
      return (
        <span className={`${base} bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
          Cleared
        </span>
      );
    }
    if (status === 'FLAGGED') {
      return (
        <span className={`${base} bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20`}>
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-2"></span>
          Blocked
        </span>
      );
    }
    if (status === 'FAILED') {
      return (
        <span className={`${base} bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20`}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-2"></span>
          Failed
        </span>
      );
    }
    return (
      <span className={`${base} bg-zinc-500/10 text-zinc-500 border-zinc-500/20`}>
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 mr-2"></span>
        {status}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out space-y-8 pb-20">
      <div className="px-2">
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tighter text-zinc-900 dark:text-white">Immutable Ledger</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-lg leading-relaxed">
          Secure, cryptographically verifiable transaction history. Real-time consensus logs reflecting double-entry invariants.
        </p>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <LiquidityCard 
            label="Total Net Indian Liquidity"
            rawValue={integrity?.total_credits ?? 0}
            isLoading={isLoading || !integrity}
            integrity={integrity}
          />

          <div className="p-8 bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-3xl shadow-sm hover:border-indigo-500/30 transition-all">
            <p className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-400 mb-4">Verification Events</p>
            <h2 className="text-3xl font-mono font-black tracking-tighter text-zinc-900 dark:text-white">
              {isLoading || !integrity ? '---' : integrity.total_entries || 0}
            </h2>
            <p className="text-[11px] font-bold text-zinc-500 mt-4 uppercase tracking-widest">Atomic Commits</p>
          </div>

          <div className="p-8 bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-3xl shadow-sm hover:border-amber-500/30 transition-all">
            <p className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-400 mb-4">Risk Profile Index</p>
            <h2 className="text-3xl font-mono font-black tracking-tighter text-zinc-900 dark:text-white">
              {isLoading || !fraudStats ? '---' : `${((1 - (fraudStats.flagged_rate || 0)) * 100).toFixed(2)}%`}
            </h2>
            <p className={`text-[11px] font-bold mt-4 uppercase tracking-widest ${(fraudStats?.flagged || 0) > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
              {(fraudStats?.flagged || 0) > 0 ? `${fraudStats.flagged} Threats Detected` : 'Secure (IST)'}
            </p>
          </div>

          <div className="p-8 bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-3xl shadow-sm hover:border-indigo-500/30 transition-all">
            <p className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-400 mb-4">Fault Tolerance</p>
            <h2 className="text-3xl font-mono font-black tracking-tighter text-zinc-900 dark:text-white">
              {isLoading || !integrity ? '---' : integrity.balanced ? 'Active' : 'Halted'}
            </h2>
            <p className="text-[11px] font-bold text-zinc-500 mt-4 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span>
              {integrity ? `${integrity.total_entries || 0} Entries Verified` : 'Checking...'}
            </p>
          </div>
        </div>
      )}

      {/* Transactions Table Section */}
      <div className="bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-8 flex items-center justify-between border-b border-zinc-100 dark:border-white/5 bg-zinc-50/30 dark:bg-transparent">
          <div>
            <h3 className="font-black tracking-tight text-zinc-900 dark:text-white uppercase text-sm">System Transaction Log</h3>
            <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-widest">Showing last {transactions.length} entries</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExport}
              disabled={isExporting || !account}
              className="hidden md:flex px-5 py-2.5 bg-zinc-50 dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400 font-bold tracking-widest border border-zinc-200 dark:border-white/10 rounded-xl text-[10px] uppercase transition-all items-center gap-2 disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[18px] ${isExporting ? 'animate-spin' : ''}`}>
                {isExporting ? 'sync' : 'download'}
              </span>
              {isExporting ? 'Generating...' : 'Export'}
            </button>
            <button onClick={fetchLedgerData} className="px-5 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-black font-black tracking-widest rounded-xl text-[10px] uppercase transition-all shadow-xl active:scale-95 flex items-center gap-2">
              <span className={`material-symbols-outlined text-[18px] ${isLoading ? 'animate-spin' : ''}`}>sync</span> Sync Ledger
            </button>
          </div>
        </div>

        {/* High-Density Data Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-white/[0.02]">
                <th className="py-5 px-8 text-[10px] uppercase tracking-[0.2em] font-black text-zinc-400">Timestamp Vector</th>
                <th className="py-5 px-8 text-[10px] uppercase tracking-[0.2em] font-black text-zinc-400">Counterparty</th>
                <th className="py-5 px-8 text-[10px] uppercase tracking-[0.2em] font-black text-zinc-400">Direction</th>
                <th className="py-5 px-8 text-[10px] uppercase tracking-[0.2em] font-black text-zinc-400">Memo</th>
                <th className="py-5 px-8 text-[10px] uppercase tracking-[0.2em] font-black text-zinc-400">Risk Score</th>
                <th className="py-5 px-8 text-[10px] uppercase tracking-[0.2em] font-black text-zinc-400 text-right">Commit Value</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {showLoading ? (
                [1,2,3,4,5,6].map(i => (
                  <tr key={i} className="border-b border-zinc-100 dark:border-white/5">
                    <td className="py-5 px-8"><Skeleton className="h-4 w-32" /></td>
                    <td className="py-5 px-8">
                       <div className="flex flex-col space-y-2">
                         <Skeleton className="h-4 w-24" />
                         <Skeleton className="h-3 w-16" />
                       </div>
                    </td>
                    <td className="py-5 px-8 flex items-center gap-3">
                       <Skeleton className="h-5 w-10 rounded px-2" />
                       <Skeleton className="h-5 w-16 rounded-full" />
                    </td>
                    <td className="py-5 px-8">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-1.5 w-16 rounded-full" />
                        <Skeleton className="h-3 w-8" />
                      </div>
                    </td>
                    <td className="py-5 px-8">
                      <div className="flex flex-col items-end space-y-2">
                         <Skeleton className="h-5 w-24" />
                         <Skeleton className="h-3 w-16" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : transactions.length === 0 ? (
                <tr><td colSpan="6" className="py-20 text-center text-zinc-500 dark:text-zinc-400 font-black uppercase tracking-widest text-[11px]">No ledger entries detected. Execute a transfer to begin.</td></tr>
              ) : (
                transactions.map((tx) => {
                  const isSender = tx.sender_account_id === account?.id;
                  const counterpart = isSender ? tx.receiver_account_id : tx.sender_account_id;
                  
                  return (
                    <tr key={tx.id} className="hover:bg-zinc-50/80 dark:hover:bg-white/[0.03] border-b border-zinc-100 dark:border-white/5 transition-all cursor-default group">
                      <td className="py-5 px-8 text-zinc-500 dark:text-zinc-400 tabular-nums font-mono text-[11px]">
                        {formatIST(tx.created_at)}
                      </td>
                      <td className="py-5 px-8">
                        <div className="flex flex-col">
                          <span className="font-mono text-[11px] font-black text-zinc-900 dark:text-white/90 uppercase truncate w-32 md:w-auto" title={counterpart}>
                            {isSender ? 'Sent to' : 'Received from'}
                          </span>
                          <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5 truncate w-32 md:w-auto" title={counterpart}>
                            {counterpart?.slice(0, 8)}...
                          </span>
                        </div>
                      </td>
                      <td className="py-5 px-8">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${isSender ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                            {isSender ? 'OUT' : 'IN'}
                          </span>
                          {getStatusBadge(tx.status)}
                        </div>
                      </td>
                      <td className="py-5 px-8">
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium max-w-[140px] truncate inline-block" title={tx.reference || 'N/A'}>
                          {tx.reference || '—'}
                        </span>
                      </td>
                      <td className="py-5 px-8">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-zinc-100 dark:bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              (tx.risk_score || 0) >= 0.7 ? 'bg-red-500' :
                              (tx.risk_score || 0) >= 0.4 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.max((tx.risk_score || 0) * 100, 3)}%` }}
                          ></div>
                        </div>
                        <span className={`text-[10px] font-mono font-bold ${
                          (tx.risk_score || 0) >= 0.7 ? 'text-red-500' :
                          (tx.risk_score || 0) >= 0.4 ? 'text-amber-500' : 'text-zinc-400'
                        }`}>
                          {((tx.risk_score || 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-5 px-8 text-right">
                      <div className="flex flex-col items-end">
                        <span className={`text-base font-mono font-black tabular-nums ${isSender ? 'text-zinc-900 dark:text-white' : 'text-emerald-500'}`}>
                          {isSender ? '-' : '+'}{formatINR(tx.amount, true)}
                        </span>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">INR Payload</span>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LiquidityCard({ label, rawValue, isLoading, integrity }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div 
      onClick={() => setRevealed(!revealed)}
      className="p-8 bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-3xl shadow-sm hover:border-indigo-500/30 transition-all bg-[radial-gradient(circle_at_100%_0%,rgba(79,70,229,0.03)_0%,transparent_70%)] cursor-pointer group overflow-hidden"
    >
      <p className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-400 mb-4 truncate">{label}</p>
      <h2 className="text-3xl font-mono font-black tracking-tighter text-zinc-900 dark:text-white overflow-hidden text-ellipsis animate-in fade-in duration-500">
        {isLoading ? '---' : formatINR(rawValue, revealed)}
      </h2>
      <div className="flex items-center gap-2 mt-4 text-[11px] font-bold text-zinc-500">
        <span className={`material-symbols-outlined text-[16px] ${!integrity ? 'text-zinc-400' : integrity.balanced ? 'text-emerald-500' : 'text-red-500'}`}>
          {!integrity ? 'pending' : integrity.balanced ? 'verified' : 'warning'}
        </span>
        {integrity
          ? integrity.balanced ? 'Ledger Balanced' : 'Imbalance Detected'
          : 'Verification pending'}
      </div>
    </div>
  );
}
