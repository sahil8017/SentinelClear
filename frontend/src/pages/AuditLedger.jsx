import React, { useState } from 'react';
import apiClient from '../lib/axios';
import { toast } from 'sonner';

export function AuditLedger() {
  const [auditStatus, setAuditStatus] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const runVerification = async () => {
    setIsVerifying(true);
    try {
      const res = await apiClient.get('/audit/verify', {
        headers: { 'X-Admin-Token': 'change-me-in-production' }
      });
      setAuditStatus(res.data);
      if (res.data.intact) {
        toast.success(`Audit chain verified. ${res.data.entries_checked} entries checked.`);
      } else {
        toast.error(`TAMPER DETECTED: at entry ${res.data.first_tampered_at}`);
      }
    } catch (err) {
      toast.error('Failed to run audit verification');
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-4">
          EOD Cryptographic Audit
          <span className="text-[10px] uppercase tracking-widest text-indigo-600 dark:text-indigo-400 font-bold px-2 py-1 rounded bg-indigo-100 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 translate-y-[-2px]">Compliance</span>
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-lg">
          Validate the mathematical integrity of the SentinelClear double-entry ledger by verifying the SHA-256 hash chain of all system actions. Detects direct row insertion or underlying database mutations.
        </p>
      </div>

      <div className="bg-white dark:bg-[#0c0d0f] border border-zinc-200 dark:border-white/5 rounded-2xl p-8 max-w-lg shadow-sm w-full">
        <button
          onClick={runVerification}
          disabled={isVerifying}
          className="w-full flex items-center justify-center gap-3 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-[12px] uppercase tracking-[0.1em] shadow-[0_4px_20px_rgba(79,70,229,0.3)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale relative z-10"
        >
          {isVerifying ? (
            <><span className="material-symbols-outlined animate-spin text-[18px]">refresh</span> Verifying Chained Hashes...</>
          ) : (
            <><span className="material-symbols-outlined text-[18px]">enhanced_encryption</span> Execute Cryptographic Hash Validation</>
          )}
        </button>

        {auditStatus && (
          <div className={`mt-8 p-6 rounded-2xl border ${auditStatus.intact ? 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20' : 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20'}`}>
            <h3 className={`font-black flex items-center gap-3 text-lg ${auditStatus.intact ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
              <span className="material-symbols-outlined text-2xl">
                {auditStatus.intact ? 'verified' : 'gpp_bad'}
              </span>
              {auditStatus.intact ? 'System Integrity: VERIFIED' : 'TAMPER DETECTED!'}
            </h3>
            
            <div className="mt-6 space-y-4 text-sm text-zinc-600 dark:text-zinc-400 font-mono text-[11px] leading-relaxed">
               <div className="flex justify-between items-center border-b border-black/5 dark:border-white/5 pb-2">
                 <span className="text-zinc-500">Hash Entries Navigated</span>
                 <span className="font-bold text-zinc-900 dark:text-white">{auditStatus.entries_checked} / {auditStatus.total_entries}</span>
               </div>
               
               <div className="flex justify-between items-center border-b border-black/5 dark:border-white/5 pb-2">
                 <span className="text-zinc-500">System Message</span>
                 <span className="font-bold text-zinc-900 dark:text-white truncate max-w-[200px]">{auditStatus.message}</span>
               </div>

               {!auditStatus.intact && (
                 <div className="pt-4 border-t border-red-200 dark:border-red-500/20 mt-4">
                   <p className="text-red-600 dark:text-red-400 font-bold flex items-start gap-2">
                     <span className="material-symbols-outlined text-[16px]">warning</span>
                     Critical Alert: Cryptographic linkage broken at entry ID #{auditStatus.first_tampered_at}. Underlying Postgres table may have been directly modified.
                   </p>
                 </div>
               )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
