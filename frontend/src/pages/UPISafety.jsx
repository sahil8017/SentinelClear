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
      toast.error('🚨 KILL SWITCH ACTIVATED', {
        description: 'All outgoing payments are now suspended.',
        duration: 8000,
        style: { background: '#1c1917', border: '2px solid #ef4444', color: '#fef2f2' },
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
      <div className="max-w-5xl mx-auto space-y-8 pb-20 px-4 sm:px-6">
        <div className="space-y-3">
          <Skeleton className="w-64 h-10" />
          <Skeleton className="w-96 h-4" />
        </div>
        <div className="bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-3xl p-8">
          <div className="flex items-center gap-4 mb-6">
            <Skeleton className="w-14 h-14 rounded-2xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="w-40 h-5" />
              <Skeleton className="w-64 h-3" />
            </div>
          </div>
          <Skeleton className="w-full h-12 rounded-xl" />
        </div>
        <div className="bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-3xl p-8">
          <div className="flex items-center gap-4 mb-6">
            <Skeleton className="w-14 h-14 rounded-2xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="w-40 h-5" />
              <Skeleton className="w-64 h-3" />
            </div>
          </div>
          <Skeleton className="w-full h-4 rounded-full mb-4" />
          <Skeleton className="w-48 h-3" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out pb-20 px-4 sm:px-6">
      <div>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tighter text-zinc-900 dark:text-white">UPI Safety Hub</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-xl leading-relaxed">
          RBI/NPCI mandated safety controls — Emergency Kill Switch and Annual Receiving Limits.
        </p>
      </div>

      {/* ═══ EMERGENCY KILL SWITCH ═══ */}
      <section className="relative">
        <div className={`p-6 sm:p-8 rounded-3xl border-2 transition-all duration-500 ${
          killSwitch?.active
            ? 'bg-red-500/5 border-red-500/40 shadow-[0_0_60px_rgba(239,68,68,0.15)]'
            : 'bg-white dark:bg-[#0c0c0d] border-zinc-200 dark:border-white/5'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                killSwitch?.active ? 'bg-red-500/20' : 'bg-zinc-100 dark:bg-white/5'
              }`}>
                <span className={`material-symbols-outlined text-3xl ${killSwitch?.active ? 'text-red-500 animate-pulse' : 'text-zinc-400'}`}>
                  power_settings_new
                </span>
              </div>
              <div>
                <h2 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Emergency Kill Switch</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Instantly freeze all outgoing UPI payments</p>
              </div>
            </div>
            <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border self-start ${
              killSwitch?.active
                ? 'bg-red-500/10 border-red-500/30 text-red-500'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
            }`}>
              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${killSwitch?.active ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></span>
              {killSwitch?.active ? 'ACTIVATED' : 'INACTIVE'}
            </div>
          </div>

          {killSwitch?.active ? (
            <div className="space-y-4">
              <div className="p-4 bg-red-500/5 rounded-2xl border border-red-500/10">
                <p className="text-sm text-red-400 font-bold">
                  🚨 All outgoing payments are suspended. No funds can leave your account.
                </p>
                {killSwitch.activated_at && (
                  <p className="text-[10px] text-zinc-500 mt-2 font-mono">
                    Activated: {new Date(killSwitch.activated_at).toLocaleString()}
                  </p>
                )}
              </div>
              {!showDeactivate ? (
                <button onClick={() => setShowDeactivate(true)}
                  className="px-6 py-3 bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-300 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-white/10 transition-all"
                >Deactivate Kill Switch</button>
              ) : (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <input type="password" value={deactivatePin} onChange={e => setDeactivatePin(e.target.value)}
                    placeholder="Enter PIN to deactivate" maxLength={6}
                    className="flex-1 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm font-mono outline-none focus:border-indigo-500 transition-all" />
                  <button onClick={handleDeactivateKS} disabled={loadingKS}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-50">
                    {loadingKS ? 'Verifying...' : 'Confirm'}
                  </button>
                  <button onClick={() => { setShowDeactivate(false); setDeactivatePin(''); }}
                    className="px-4 py-3 text-zinc-400 hover:text-zinc-600 transition-colors self-center">
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={handleActivateKS} disabled={loadingKS}
              className="w-full py-5 bg-red-600 hover:bg-red-700 text-white shadow-2xl shadow-red-500/20 font-black uppercase tracking-widest rounded-2xl text-[12px] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 group overflow-hidden relative">
              {loadingKS ? (
                <span className="flex items-center gap-3"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Processing...</span>
              ) : (
                <>
                  <span className="material-symbols-outlined text-xl">emergency</span>
                  Activate Emergency Kill Switch
                </>
              )}
            </button>
          )}
        </div>
      </section>

      {/* ═══ ANNUAL RECEIVING LIMIT ═══ */}
      <section>
        <div className="bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-amber-500 text-xl">account_balance_wallet</span>
            </div>
            <div>
              <h3 className="text-lg font-black text-zinc-900 dark:text-white tracking-tight">Annual Receiving Limit</h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">₹25 Lakh Fiscal Year Cap</p>
            </div>
          </div>

          {annualLimit && (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500 font-bold">FY {annualLimit.fiscal_year || '—'}</span>
                  <span className={`font-black ${annualLimit.is_frozen ? 'text-red-500' : 'text-zinc-900 dark:text-white'}`}>
                    {formatINR(annualLimit.annual_received)} / {formatINR(annualLimit.annual_limit)}
                  </span>
                </div>
                <div className="w-full h-3 bg-zinc-100 dark:bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      annualPercent >= 100 ? 'bg-red-500' : annualPercent >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${annualPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-zinc-400 font-bold">{annualPercent.toFixed(1)}% utilized</span>
                  <span className="text-zinc-400 font-bold">Remaining: {formatINR(annualLimit.remaining)}</span>
                </div>
              </div>

              {annualLimit.is_frozen && (
                <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-2xl">
                  <p className="text-xs text-red-400 font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">lock</span>
                    Account FROZEN — Visit your bank to explain the source of funds.
                  </p>
                </div>
              )}

              {/* Key Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-zinc-100 dark:border-white/5">
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-100 dark:border-white/5">
                  <p className="text-[8px] text-zinc-400 uppercase tracking-widest font-black">Status</p>
                  <p className={`text-sm font-black mt-1 ${annualLimit.is_frozen ? 'text-red-500' : 'text-emerald-500'}`}>
                    {annualLimit.is_frozen ? 'FROZEN' : 'ACTIVE'}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-100 dark:border-white/5">
                  <p className="text-[8px] text-zinc-400 uppercase tracking-widest font-black">Total Received</p>
                  <p className="text-sm font-black mt-1 text-zinc-900 dark:text-white">{formatINR(annualLimit.annual_received)}</p>
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-100 dark:border-white/5">
                  <p className="text-[8px] text-zinc-400 uppercase tracking-widest font-black">Headroom</p>
                  <p className="text-sm font-black mt-1 text-zinc-900 dark:text-white">{formatINR(annualLimit.remaining)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
