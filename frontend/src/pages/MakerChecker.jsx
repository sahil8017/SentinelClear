import React, { useState, useEffect } from 'react';
import apiClient from '../lib/axios';
import { toast } from 'sonner';
import { formatINR, formatIST } from '../lib/format';

export function MakerChecker() {
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchPendingTransfers();
  }, []);

  const fetchPendingTransfers = async () => {
    try {
      const res = await apiClient.get('/transfers/admin/pending');
      setPendingTransfers(res.data);
    } catch (err) {
      toast.error('Failed to load pending approvals');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (transferId, action) => {
    setProcessingId(transferId);
    try {
      if (action === 'approve') {
        await apiClient.post(`/transfers/${transferId}/approve`);
        toast.success('Transfer approved & ledger committed.');
      } else {
        await apiClient.post(`/transfers/${transferId}/reject`);
        toast.error('Transfer rejected.');
      }
      // Remove from list
      setPendingTransfers(prev => prev.filter(t => t.id !== transferId));
    } catch (err) {
      toast.error(err.response?.data?.detail || `Failed to ${action} transfer`);
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <span className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out pb-20">
      <div className="px-2">
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tighter text-zinc-900 dark:text-white">Maker-Checker Queue</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-lg leading-relaxed">
          Four-Eyes Principle Enforcement. High-value transactions awaiting cryptographic separation of duties approval.
        </p>
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-3xl overflow-hidden shadow-xl shadow-indigo-500/5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-white/5 text-zinc-500 dark:text-zinc-400 font-bold tracking-wider">
              <tr>
                <th className="px-6 py-5">TID / Time</th>
                <th className="px-6 py-5">Maker (Initiator)</th>
                <th className="px-6 py-5">Destination</th>
                <th className="px-6 py-5 text-right">Amount</th>
                <th className="px-6 py-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
              {pendingTransfers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-zinc-500">
                    <div className="flex flex-col items-center gap-3">
                      <span className="material-symbols-outlined text-4xl text-zinc-300 dark:text-zinc-700">fact_check</span>
                      <p className="font-semibold text-lg">Inbox Zero</p>
                      <p className="text-sm opacity-70">No pending transfers requiring approval.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                pendingTransfers.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono font-medium text-zinc-900 dark:text-zinc-300">
                          {t.id.slice(0, 8)}...
                        </span>
                        <span className="text-xs text-zinc-500">{formatIST(t.created_at)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-zinc-600 dark:text-zinc-400">{t.sender_account_id.slice(0,18)}...</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-zinc-600 dark:text-zinc-400">{t.receiver_account_id.slice(0,18)}...</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold tracking-tight text-zinc-900 dark:text-white">
                        {formatINR(t.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3 justify-end">
                        <button
                          onClick={() => handleAction(t.id, 'reject')}
                          disabled={processingId === t.id}
                          className="px-4 py-2 border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleAction(t.id, 'approve')}
                          disabled={processingId === t.id}
                          className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          {processingId === t.id && (
                            <span className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin"></span>
                          )}
                          Approve
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
