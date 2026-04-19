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
        <span className="w-6 h-6 rounded-full border-2 border-[#635BFF] border-t-transparent animate-spin"></span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-8 fade-in duration-500 pb-20 px-4 md:px-0">
      <div>
        <h1 className="text-[32px] md:text-[40px] font-light tracking-tight text-[#0A2540] m-0">Maker-Checker Queue</h1>
        <p className="text-[14px] text-[#425466] mt-2 max-w-lg leading-[1.6]">
          Four-Eyes Principle. High-value transactions awaiting separation-of-duties approval.
        </p>
      </div>

      <div className="bg-white border border-[#e3e8ee] rounded-[16px] overflow-hidden shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-left">
            <thead className="bg-[#f6f9fc] border-b border-[#e3e8ee]">
              <tr>
                <th className="px-6 py-4 text-[11px] uppercase font-bold tracking-wider text-[#6B7C93]">TID / Time</th>
                <th className="px-6 py-4 text-[11px] uppercase font-bold tracking-wider text-[#6B7C93]">Maker (Initiator)</th>
                <th className="px-6 py-4 text-[11px] uppercase font-bold tracking-wider text-[#6B7C93]">Destination</th>
                <th className="px-6 py-4 text-[11px] uppercase font-bold tracking-wider text-[#6B7C93] text-right">Amount</th>
                <th className="px-6 py-4 text-[11px] uppercase font-bold tracking-wider text-[#6B7C93] text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e3e8ee]">
              {pendingTransfers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-[#6B7C93]">
                    <div className="flex flex-col items-center gap-3">
                      <span className="material-symbols-outlined text-[40px] text-[#e3e8ee]">fact_check</span>
                      <p className="font-medium text-[16px] text-[#0A2540]">Inbox Zero</p>
                      <p className="text-[13px] text-[#6B7C93]">No pending transfers requiring approval.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                pendingTransfers.map((t) => (
                  <tr key={t.id} className="hover:bg-[#f6f9fc] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono font-medium text-[#0A2540]">
                          {t.id.slice(0, 8)}...
                        </span>
                        <span className="text-[11px] text-[#6B7C93]">{formatIST(t.created_at)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-[#425466] text-[12px]">{t.sender_account_id.slice(0,18)}...</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-[#425466] text-[12px]">{t.receiver_account_id.slice(0,18)}...</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-semibold text-[#0A2540]">
                        {formatINR(t.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => handleAction(t.id, 'reject')}
                          disabled={processingId === t.id}
                          className="px-3 py-1.5 border border-[#df1b41] text-[#df1b41] hover:bg-[#fff5f5] rounded-[6px] text-[12px] font-medium transition-colors disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleAction(t.id, 'approve')}
                          disabled={processingId === t.id}
                          className="px-3 py-1.5 bg-[#635BFF] hover:bg-[#5851db] text-white rounded-[6px] text-[12px] font-medium shadow-[0_1px_3px_rgba(99,91,255,0.3)] transition-all flex items-center gap-1.5 disabled:opacity-50"
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
