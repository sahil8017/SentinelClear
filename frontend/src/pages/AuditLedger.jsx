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
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-8 fade-in duration-500 pb-20 px-4 md:px-0">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[32px] md:text-[40px] font-light tracking-tight text-[#0A2540] m-0">EOD Cryptographic Audit</h1>
          <span className="text-[10px] uppercase tracking-wider text-[#635BFF] font-bold px-2 py-1 rounded bg-[#f0eeff] border border-[#635BFF]/20">Compliance</span>
        </div>
        <p className="text-[14px] text-[#425466] mt-2 max-w-lg leading-[1.6]">
          Validate the mathematical integrity of the SentinelClear double-entry ledger by verifying the SHA-256 hash chain.
        </p>
      </div>

      <div className="bg-white border border-[#e3e8ee] rounded-[16px] p-6 md:p-8 max-w-lg shadow-[0_2px_5px_rgba(0,0,0,0.02)] w-full">
        <button
          onClick={runVerification}
          disabled={isVerifying}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[#635BFF] hover:bg-[#5851db] text-white font-medium rounded-[8px] text-[14px] shadow-[0_2px_5px_rgba(99,91,255,0.3)] transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {isVerifying ? (
            <><span className="material-symbols-outlined animate-spin text-[18px]">refresh</span> Verifying...</>
          ) : (
            <><span className="material-symbols-outlined text-[18px]">enhanced_encryption</span> Execute Hash Validation</>
          )}
        </button>

        {auditStatus && (
          <div className={`mt-6 p-6 rounded-[12px] border ${auditStatus.intact ? 'bg-[#e7f9ed] border-[#0CBF4C]/20' : 'bg-[#fff5f5] border-[#ffcdcd]'}`}>
            <h3 className={`font-medium flex items-center gap-2 text-[16px] ${auditStatus.intact ? 'text-[#0CBF4C]' : 'text-[#df1b41]'}`}>
              <span className="material-symbols-outlined text-[24px]">
                {auditStatus.intact ? 'verified' : 'gpp_bad'}
              </span>
              {auditStatus.intact ? 'Integrity: VERIFIED' : 'TAMPER DETECTED'}
            </h3>
            
            <div className="mt-4 space-y-3 text-[13px] font-mono">
               <div className="flex justify-between items-center border-b border-[#e3e8ee] pb-2">
                 <span className="text-[#6B7C93]">Entries Verified</span>
                 <span className="font-medium text-[#0A2540]">{auditStatus.entries_checked} / {auditStatus.total_entries}</span>
               </div>
               
               <div className="flex justify-between items-center border-b border-[#e3e8ee] pb-2">
                 <span className="text-[#6B7C93]">Message</span>
                 <span className="font-medium text-[#0A2540] truncate max-w-[200px]">{auditStatus.message}</span>
               </div>

               {!auditStatus.intact && (
                 <div className="pt-3 border-t border-[#ffcdcd] mt-3">
                   <p className="text-[#df1b41] font-medium flex items-start gap-2 text-[12px]">
                     <span className="material-symbols-outlined text-[14px]">warning</span>
                     Cryptographic linkage broken at entry #{auditStatus.first_tampered_at}.
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
