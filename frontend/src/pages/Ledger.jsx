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

      if (results[0].status === 'fulfilled') setTransactions(results[0].value.data);
      if (results[1].status === 'fulfilled') setAccount(results[1].value.data);
      
      if (isAdmin) {
        if (results[2].status === 'fulfilled') setIntegrity(results[2].value.data);
        if (results[3].status === 'fulfilled') setFraudStats(results[3].value.data);
      }
    } catch (err) {
      console.error('Ledger sync failure', err);
      toast.error('Cryptographic sync failed. Reconnecting to ledger...');
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
      toast.error('Failed to generate PDF statement');
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusBadge = (status) => {
    const base = "inline-flex items-center px-2 py-0.5 rounded-[4px] text-[10px] font-bold tracking-widest uppercase border transition-all";
    if (status === 'COMPLETED') {
      return (
        <span className={`${base} bg-[#f6f9fc] text-[#0CBF4C] border-[#e3e8ee]`}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#0CBF4C] mr-1.5 shadow-[0_0_5px_rgba(12,191,76,0.3)]"></span>
          Cleared
        </span>
      );
    }
    if (status === 'FLAGGED') {
      return (
        <span className={`${base} bg-[#fff5f5] text-[#df1b41] border-[#ffcdcd]`}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#df1b41] mr-1.5"></span>
          Blocked
        </span>
      );
    }
    if (status === 'FAILED') {
      return (
        <span className={`${base} bg-[#fff5f2] text-[#ff6118] border-[#ffe0d4]`}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#ff6118] mr-1.5"></span>
          Failed
        </span>
      );
    }
    return (
      <span className={`${base} bg-[#f6f9fc] text-[#6B7C93] border-[#e3e8ee]`}>
        <span className="w-1.5 h-1.5 rounded-full bg-[#6B7C93] mr-1.5"></span>
        {status}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6 md:space-y-8 pb-20 fade-in px-2 md:px-0">
      <div>
        <h1 className="text-[32px] md:text-[40px] font-light tracking-tight text-[#0A2540] m-0">Ledger Registry</h1>
        <p className="text-[14px] md:text-[15px] text-[#425466] mt-2 max-w-xl leading-[1.6]">
          Secure, cryptographically verifiable transaction history. Real-time consensus logs reflecting double-entry invariants.
        </p>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <LiquidityCard 
            label="Total Net Indian Liquidity"
            rawValue={integrity?.total_credits ?? 0}
            isLoading={isLoading || !integrity}
            integrity={integrity}
          />

          <div className="p-6 bg-white border border-[#e3e8ee] rounded-[16px] shadow-[0_2px_5px_rgba(0,0,0,0.02)] hover:shadow-[0_5px_15px_rgba(0,0,0,0.05)] transition-all">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#6B7C93] mb-3">Verification Events</p>
            <h2 className="text-[28px] font-light tracking-tight text-[#0A2540] truncate">
              {isLoading || !integrity ? '---' : integrity.total_entries || 0}
            </h2>
            <p className="text-[12px] font-medium text-[#425466] mt-2">Atomic Commits</p>
          </div>

          <div className="p-6 bg-white border border-[#e3e8ee] rounded-[16px] shadow-[0_2px_5px_rgba(0,0,0,0.02)] hover:shadow-[0_5px_15px_rgba(0,0,0,0.05)] transition-all">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#6B7C93] mb-3">Risk Profile Index</p>
            <h2 className="text-[28px] font-light tracking-tight text-[#0A2540] truncate">
              {isLoading || !fraudStats ? '---' : `${((1 - (fraudStats.flagged_rate || 0)) * 100).toFixed(2)}%`}
            </h2>
            <p className={`text-[12px] font-medium mt-2 ${(fraudStats?.flagged || 0) > 0 ? 'text-[#ff6118]' : 'text-[#0CBF4C]'}`}>
              {(fraudStats?.flagged || 0) > 0 ? `${fraudStats.flagged} Threats Detected` : 'Secure (IST)'}
            </p>
          </div>

          <div className="p-6 bg-white border border-[#e3e8ee] rounded-[16px] shadow-[0_2px_5px_rgba(0,0,0,0.02)] hover:shadow-[0_5px_15px_rgba(0,0,0,0.05)] transition-all">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#6B7C93] mb-3">Fault Tolerance</p>
            <h2 className="text-[28px] font-light tracking-tight text-[#0A2540] truncate">
              {isLoading || !integrity ? '---' : integrity.balanced ? 'Active' : 'Halted'}
            </h2>
            <p className="text-[12px] font-medium text-[#425466] mt-2 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${integrity?.balanced ? 'bg-[#0CBF4C]' : 'bg-[#df1b41]'}`}></span>
              {integrity ? `${integrity.total_entries || 0} Entries Verified` : 'Checking...'}
            </p>
          </div>
        </div>
      )}

      {/* Transactions Table Section */}
      <div className="bg-white border border-[#e3e8ee] rounded-[16px] shadow-[0_2px_5px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-[#e3e8ee] bg-[#f6f9fc] gap-4">
          <div>
            <h3 className="font-semibold tracking-tight text-[#0A2540] text-[15px]">System Transaction Log</h3>
            <p className="text-[12px] text-[#6B7C93] mt-0.5 font-medium">Showing last {transactions.length} entries</p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button
              onClick={handleExport}
              disabled={isExporting || !account}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-white hover:bg-[#e3e8ee] text-[#425466] font-medium border border-[#e3e8ee] rounded text-[13px] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[16px] ${isExporting ? 'animate-spin' : ''}`}>
                {isExporting ? 'sync' : 'download'}
              </span>
              {isExporting ? 'Generating...' : 'Export'}
            </button>
            <button onClick={fetchLedgerData} className="flex-1 sm:flex-none px-4 py-2.5 bg-[#0A2540] hover:bg-[#112F4E] text-white font-medium rounded text-[13px] transition-all flex items-center justify-center gap-2">
              <span className={`material-symbols-outlined text-[16px] ${isLoading ? 'animate-spin' : ''}`}>sync</span> Sync Ledger
            </button>
          </div>
        </div>

        {/* High-Density Data Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="border-b border-[#e3e8ee] bg-[#f6f9fc]">
                <th className="py-4 px-6 text-[11px] font-bold text-[#6B7C93] uppercase tracking-wider">Timestamp Vector</th>
                <th className="py-4 px-6 text-[11px] font-bold text-[#6B7C93] uppercase tracking-wider">Counterparty</th>
                <th className="py-4 px-6 text-[11px] font-bold text-[#6B7C93] uppercase tracking-wider">Direction</th>
                <th className="py-4 px-6 text-[11px] font-bold text-[#6B7C93] uppercase tracking-wider">Memo</th>
                <th className="py-4 px-6 text-[11px] font-bold text-[#6B7C93] uppercase tracking-wider">Risk Score</th>
                <th className="py-4 px-6 text-[11px] font-bold text-[#6B7C93] uppercase tracking-wider text-right">Commit Value</th>
              </tr>
            </thead>
            <tbody className="text-[13px]">
              {showLoading ? (
                [1,2,3,4,5,6].map(i => (
                  <tr key={i} className="border-b border-[#e3e8ee]">
                    <td className="py-4 px-6"><Skeleton className="h-4 w-28" /></td>
                    <td className="py-4 px-6">
                       <div className="flex flex-col gap-1.5">
                         <Skeleton className="h-4 w-24" />
                         <Skeleton className="h-3 w-16" />
                       </div>
                    </td>
                    <td className="py-4 px-6 flex items-center gap-2 mt-2">
                       <Skeleton className="h-5 w-8 rounded" />
                       <Skeleton className="h-5 w-16 rounded" />
                    </td>
                    <td className="py-4 px-6"><Skeleton className="h-4 w-28" /></td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col items-start gap-1">
                         <Skeleton className="h-1.5 w-16 rounded-full" />
                         <Skeleton className="h-3 w-6" />
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col items-end gap-1.5">
                         <Skeleton className="h-4 w-20" />
                         <Skeleton className="h-3 w-12" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : transactions.length === 0 ? (
                <tr><td colSpan="6" className="py-16 text-center text-[#6B7C93] font-medium text-[13px]">No ledger entries detected. Execute a transfer to begin.</td></tr>
              ) : (
                transactions.map((tx) => {
                  const isSender = tx.sender_account_id === account?.id;
                  const counterpart = isSender ? tx.receiver_account_id : tx.sender_account_id;
                  
                  return (
                    <tr key={tx.id} className="hover:bg-[#f6f9fc] border-b border-[#e3e8ee] transition-colors cursor-default group">
                      <td className="py-4 px-6 text-[#6B7C93] tabular-nums font-mono text-[12px]">
                        {formatIST(tx.created_at)}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="font-mono text-[12px] font-semibold text-[#0A2540] uppercase truncate w-32 md:w-auto" title={counterpart}>
                            {isSender ? 'Sent to' : 'Received from'}
                          </span>
                          <span className="text-[11px] text-[#6B7C93] font-mono mt-0.5 truncate w-32 md:w-auto" title={counterpart}>
                            {counterpart?.slice(0, 10)}...
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isSender ? 'bg-[#fff5f2] text-[#ff6118]' : 'bg-[#e7f9ed] text-[#0CBF4C]'}`}>
                            {isSender ? 'OUT' : 'IN'}
                          </span>
                          {getStatusBadge(tx.status)}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-[13px] text-[#425466] font-medium max-w-[160px] truncate inline-block" title={tx.reference || 'N/A'}>
                          {tx.reference || '—'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col gap-1">
                          <div className="w-16 h-1.5 bg-[#e3e8ee] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                (tx.risk_score || 0) >= 0.7 ? 'bg-[#df1b41]' :
                                (tx.risk_score || 0) >= 0.4 ? 'bg-[#ff6118]' : 'bg-[#0CBF4C]'
                              }`}
                              style={{ width: `${Math.max((tx.risk_score || 0) * 100, 5)}%` }}
                            ></div>
                          </div>
                          <span className={`text-[11px] font-mono font-medium ${
                            (tx.risk_score || 0) >= 0.7 ? 'text-[#df1b41]' :
                            (tx.risk_score || 0) >= 0.4 ? 'text-[#ff6118]' : 'text-[#6B7C93]'
                          }`}>
                            {((tx.risk_score || 0) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex flex-col items-end">
                          <span className={`text-[15px] font-mono font-semibold tabular-nums ${isSender ? 'text-[#0A2540]' : 'text-[#0CBF4C]'}`}>
                            {isSender ? '-' : '+'}{formatINR(tx.amount, true)}
                          </span>
                          <span className="text-[10px] font-bold text-[#6B7C93] uppercase mt-0.5">INR Payload</span>
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
      className="p-6 bg-white border border-[#e3e8ee] rounded-[16px] shadow-[0_2px_5px_rgba(0,0,0,0.02)] hover:shadow-[0_5px_15px_rgba(0,0,0,0.05)] transition-all cursor-pointer group overflow-hidden"
    >
      <p className="text-[11px] font-bold uppercase tracking-widest text-[#635BFF] mb-3 truncate">{label}</p>
      <h2 className="text-[28px] font-light tracking-tight text-[#0A2540] truncate transition-opacity duration-300">
        {isLoading ? '---' : revealed ? formatINR(rawValue, true) : '₹ •••••••••'}
      </h2>
      <div className="flex items-center gap-1.5 mt-2 text-[12px] font-medium text-[#425466]">
        <span className={`material-symbols-outlined text-[16px] ${!integrity ? 'text-[#6B7C93]' : integrity.balanced ? 'text-[#0CBF4C]' : 'text-[#df1b41]'}`}>
          {!integrity ? 'pending' : integrity.balanced ? 'verified' : 'warning'}
        </span>
        {integrity
          ? integrity.balanced ? 'Ledger Balanced' : 'Imbalance Detected'
          : 'Verification pending'}
      </div>
    </div>
  );
}
