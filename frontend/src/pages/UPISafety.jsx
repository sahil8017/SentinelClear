import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../lib/axios';
import { toast } from 'sonner';
import { formatINR } from '../lib/format';
import { useMinLoadingTime } from '../lib/useMinLoadingTime';
import { Skeleton } from '../components/ui/Skeleton';

export function UPISafety() {
  const [killSwitch, setKillSwitch] = useState(null);
  const [annualLimit, setAnnualLimit] = useState(null);
  const [loadingKS, setLoadingKS] = useState(false);
  const [deactivatePin, setDeactivatePin] = useState('');
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [ksRes, alRes] = await Promise.all([
        apiClient.get('/accounts/kill-switch/status'),
        apiClient.get('/accounts/annual-limit/status'),
      ]);
      setKillSwitch(ksRes.data);
      setAnnualLimit(alRes.data);
    } catch (err) {
      console.error('UPI Safety data fetch failed', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Kill Switch ──
  const handleActivateKS = async () => {
    setLoadingKS(true);
    try {
      const res = await apiClient.post('/accounts/kill-switch/activate');
      setKillSwitch(res.data);
      toast.error('KILL SWITCH ACTIVATED', {
        description: 'All outgoing payments are now suspended.',
        duration: 8000,
      });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to activate kill switch');
    } finally { setLoadingKS(false); }
  };

  const handleDeactivateKS = async () => {
    if (!deactivatePin) {
      toast.error('Enter your transaction PIN to deactivate');
      return;
    }
    setLoadingKS(true);
    try {
      const res = await apiClient.post('/accounts/kill-switch/deactivate', { pin: deactivatePin });
      setKillSwitch(res.data);
      setDeactivatePin('');
      setShowDeactivate(false);
      toast.success('Kill switch deactivated. Payments resumed.', { duration: 5000 });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to deactivate');
    } finally { setLoadingKS(false); }
  };

  const annualPercent = annualLimit
    ? Math.min(100, (annualLimit.annual_received / annualLimit.annual_limit) * 100)
    : 0;
  const showSkeleton = useMinLoadingTime(isLoading, 1200);

  if (showSkeleton) {
    return (
      <div className="max-w-5xl mx-auto space-y-8 pb-20 px-4 md:px-0">
        <div className="space-y-3">
          <Skeleton className="w-64 h-10 rounded-[8px]" />
          <Skeleton className="w-96 h-4 rounded-[4px]" />
        </div>
        <div className="bg-white border border-[#e3e8ee] rounded-[16px] p-6 md:p-8">
          <div className="flex items-center gap-4 mb-6">
            <Skeleton className="w-14 h-14 rounded-[8px]" />
            <div className="space-y-2 flex-1">
              <Skeleton className="w-40 h-5 rounded-[4px]" />
              <Skeleton className="w-64 h-3 rounded-[4px]" />
            </div>
          </div>
          <Skeleton className="w-full h-12 rounded-[8px]" />
        </div>
        <div className="bg-white border border-[#e3e8ee] rounded-[16px] p-6 md:p-8">
          <div className="flex items-center gap-4 mb-6">
            <Skeleton className="w-14 h-14 rounded-[8px]" />
            <div className="space-y-2 flex-1">
              <Skeleton className="w-40 h-5 rounded-[4px]" />
              <Skeleton className="w-64 h-3 rounded-[4px]" />
            </div>
          </div>
          <Skeleton className="w-full h-4 rounded-full mb-4" />
          <Skeleton className="w-48 h-3 rounded-[4px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 fade-in duration-500 pb-20 px-4 md:px-0">
      <div>
        <h1 className="text-[32px] md:text-[40px] font-light tracking-tight text-[#0A2540] m-0">UPI Safety Hub</h1>
        <p className="text-[14px] md:text-[15px] text-[#425466] mt-2 max-w-xl leading-[1.6]">
          RBI mandated safety controls — Emergency Kill Switch and Annual Receiving Limits.
        </p>
      </div>

      {/* ═══ EMERGENCY KILL SWITCH ═══ */}
      <section className="relative">
        <div className={`p-6 sm:p-8 rounded-[16px] border transition-all duration-300 ${
          killSwitch?.active
            ? 'bg-[#fff5f5] border-[#ffcdcd] shadow-[0_4px_15px_rgba(223,27,65,0.08)]'
            : 'bg-white border-[#e3e8ee] shadow-[0_2px_5px_rgba(0,0,0,0.02)]'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-[8px] flex items-center justify-center shrink-0 transition-colors ${
                killSwitch?.active ? 'bg-[#df1b41]/10' : 'bg-[#f6f9fc] border border-[#e3e8ee]'
              }`}>
                <span className={`material-symbols-outlined text-[24px] ${killSwitch?.active ? 'text-[#df1b41]' : 'text-[#6B7C93]'}`}>
                  power_settings_new
                </span>
              </div>
              <div>
                <h2 className="text-[18px] font-medium text-[#0A2540]">Emergency Kill Switch</h2>
                <p className="text-[13px] text-[#6B7C93] mt-0.5">Instantly freeze all outgoing payments</p>
              </div>
            </div>
            <div className={`px-3 py-1 rounded-[4px] text-[10px] font-bold uppercase tracking-wider self-start flex items-center gap-2 border ${
              killSwitch?.active
                ? 'bg-[#fff5f5] border-[#ffcdcd] text-[#df1b41]'
                : 'bg-[#e7f9ed] border-[#0CBF4C]/20 text-[#0CBF4C]'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${killSwitch?.active ? 'bg-[#df1b41] animate-pulse' : 'bg-[#0CBF4C]'}`}></span>
              {killSwitch?.active ? 'ACTIVATED' : 'INACTIVE'}
            </div>
          </div>

          {killSwitch?.active ? (
            <div className="space-y-5">
              <div className="p-4 bg-white border border-[#ffcdcd] rounded-[8px] shadow-[0_1px_2px_rgba(223,27,65,0.05)]">
                <p className="text-[13px] text-[#df1b41] font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">warning</span>
                  All outgoing payments are suspended. No funds can leave your account.
                </p>
                {killSwitch.activated_at && (
                  <p className="text-[11px] text-[#6B7C93] mt-1 font-mono">
                    Activated: {new Date(killSwitch.activated_at).toLocaleString()}
                  </p>
                )}
              </div>
              {!showDeactivate ? (
                <button onClick={() => setShowDeactivate(true)}
                  className="px-6 py-2.5 bg-white border border-[#e3e8ee] hover:bg-[#f6f9fc] text-[#0A2540] font-medium rounded-[8px] text-[14px] transition-colors"
                >Deactivate Kill Switch</button>
              ) : (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <input type="password" value={deactivatePin} onChange={e => setDeactivatePin(e.target.value)}
                    placeholder="Enter PIN to deactivate" maxLength={6}
                    className="flex-1 bg-white border border-[#e3e8ee] rounded-[8px] px-4 py-3 text-[14px] font-mono outline-none focus:border-[#635BFF] transition-all" />
                  <button onClick={handleDeactivateKS} disabled={loadingKS}
                    className="px-6 py-3 bg-[#0A2540] hover:bg-[#112F4E] text-white rounded-[8px] text-[14px] font-medium transition-colors disabled:opacity-50">
                    {loadingKS ? 'Verifying...' : 'Confirm PIN'}
                  </button>
                  <button onClick={() => { setShowDeactivate(false); setDeactivatePin(''); }}
                    className="px-4 py-3 bg-white border border-[#e3e8ee] text-[#6B7C93] hover:bg-[#f6f9fc] rounded-[8px] transition-colors self-center">
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={handleActivateKS} disabled={loadingKS}
              className="w-full py-3.5 bg-white border border-[#df1b41] hover:bg-[#fff5f5] text-[#df1b41] font-medium rounded-[8px] text-[14px] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {loadingKS ? (
                <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-[#df1b41]/30 border-t-[#df1b41] rounded-full animate-spin"></span> Processing...</span>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">emergency</span>
                  Activate Kill Switch
                </>
              )}
            </button>
          )}
        </div>
      </section>

      {/* ═══ ANNUAL RECEIVING LIMIT ═══ */}
      <section>
        <div className="bg-white border border-[#e3e8ee] rounded-[16px] p-6 sm:p-8 shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-[8px] bg-[#f6f9fc] border border-[#e3e8ee] flex items-center justify-center">
              <span className="material-symbols-outlined text-[#6B7C93] text-[24px]">account_balance_wallet</span>
            </div>
            <div>
              <h3 className="text-[18px] font-medium text-[#0A2540]">Annual Receiving Limit</h3>
              <p className="text-[13px] text-[#6B7C93] mt-0.5">₹25 Lakh Fiscal Year Cap</p>
            </div>
          </div>

          {annualLimit && (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-[13px]">
                  <span className="text-[#425466] font-medium">FY {annualLimit.fiscal_year || '—'} Utilization</span>
                  <span className={`font-semibold font-mono ${annualLimit.is_frozen ? 'text-[#df1b41]' : 'text-[#0A2540]'}`}>
                    {formatINR(annualLimit.annual_received)} / {formatINR(annualLimit.annual_limit)}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-[#e3e8ee] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      annualPercent >= 100 ? 'bg-[#df1b41]' : annualPercent >= 80 ? 'bg-[#ff6118]' : 'bg-[#0CBF4C]'
                    }`}
                    style={{ width: `${annualPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-medium text-[#6B7C93]">
                  <span>{annualPercent.toFixed(1)}% utilized</span>
                  <span>Headroom: {formatINR(annualLimit.remaining)}</span>
                </div>
              </div>

              {annualLimit.is_frozen && (
                <div className="p-4 bg-[#fff5f5] border border-[#ffcdcd] rounded-[8px]">
                  <p className="text-[13px] text-[#df1b41] font-semibold flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">lock</span>
                    Account FROZEN. You have exceeded the annual receiving limits.
                  </p>
                </div>
              )}

              {/* Key Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-[#e3e8ee]">
                <div className="p-4 rounded-[8px] bg-[#f6f9fc] border border-[#e3e8ee]">
                  <p className="text-[10px] text-[#6B7C93] uppercase font-bold tracking-wider">Status</p>
                  <p className={`text-[16px] font-medium mt-1 ${annualLimit.is_frozen ? 'text-[#df1b41]' : 'text-[#0CBF4C]'}`}>
                    {annualLimit.is_frozen ? 'FROZEN' : 'ACTIVE'}
                  </p>
                </div>
                <div className="p-4 rounded-[8px] bg-[#f6f9fc] border border-[#e3e8ee]">
                  <p className="text-[10px] text-[#6B7C93] uppercase font-bold tracking-wider">Total Received</p>
                  <p className="text-[16px] font-medium text-[#0A2540] mt-1">{formatINR(annualLimit.annual_received)}</p>
                </div>
                <div className="p-4 rounded-[8px] bg-[#f6f9fc] border border-[#e3e8ee]">
                  <p className="text-[10px] text-[#6B7C93] uppercase font-bold tracking-wider">Remaining</p>
                  <p className="text-[16px] font-medium text-[#0A2540] mt-1">{formatINR(annualLimit.remaining)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
