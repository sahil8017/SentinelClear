import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../lib/axios';
import { toast } from 'sonner';
import { formatINR } from '../lib/format';
import { AuthModal } from '../components/AuthModal';

export function Transfer() {
  const [formData, setFormData] = useState({
    receiver: '',
    amount: '',
    reference: '',
    ip_override: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [account, setAccount] = useState(null);
  const [trustScore, setTrustScore] = useState(99.8);
  const [isScanning, setIsScanning] = useState(false);
  const [fraudBlock, setFraudBlock] = useState(null);
  const [stepUpChallenge, setStepUpChallenge] = useState(null);
  const [pausedTransfer, setPausedTransfer] = useState(null);
  const [guardianPending, setGuardianPending] = useState(null);
  const [confirmingPause, setConfirmingPause] = useState(false);
  // Whitelist
  const [whitelist, setWhitelist] = useState([]);
  const [wlAccountId, setWlAccountId] = useState('');
  const [wlNickname, setWlNickname] = useState('');
  const [showWhitelist, setShowWhitelist] = useState(false);

  const fetchWhitelist = useCallback(async () => {
    try {
      const res = await apiClient.get('/whitelist');
      setWhitelist(res.data);
    } catch (e) { console.error('Whitelist fetch failed', e); }
  }, []);

  useEffect(() => {
    apiClient.get('/accounts/me')
      .then(res => setAccount(res.data))
      .catch(err => console.error('Account sync failure', err));
    fetchWhitelist();
  }, [fetchWhitelist]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.receiver || !formData.amount) return;

    setIsLoading(true);
    setIsScanning(true);
    setFraudBlock(null);

    // Brief "scanning" delay for the radar animation
    await new Promise(r => setTimeout(r, 800));

    try {
      const payload = {
        receiver_account_id: formData.receiver,
        amount: parseFloat(formData.amount),
        currency: 'INR',
        reference: formData.reference || 'Network Transfer'
      };
      if (formData.ip_override) {
        payload.ip_override = formData.ip_override;
      }
      const res = await apiClient.post('/transfers', payload);

      // Check if 202 (PAUSED or PENDING_GUARDIAN)
      if (res.status === 202) {
        const data = res.data;
        if (data.status === 'PAUSED') {
          setPausedTransfer({
            transferId: data.transfer_id,
            cooldown: data.cooldown_seconds,
            detail: data.detail,
          });
          toast.warning('⏸️ Transaction Paused', {
            description: data.detail,
            duration: 8000,
            style: { background: '#1c1917', border: '2px solid #f59e0b', color: '#fef3c7' },
          });
        } else if (data.status === 'PENDING_GUARDIAN') {
          setGuardianPending({
            transferId: data.transfer_id,
            message: data.message,
          });
          toast.info('👤 Guardian Approval Required', {
            description: data.message,
            duration: 8000,
            style: { background: '#1c1917', border: '2px solid #8b5cf6', color: '#ede9fe' },
          });
        }
        setFormData({ receiver: '', amount: '', reference: '', ip_override: '' });
        apiClient.get('/accounts/me').then(r => setAccount(r.data));
        return;
      }

      toast.success('Funds securely transferred & audited.');
      setFormData({ receiver: '', amount: '', reference: '', ip_override: '' });
      setTrustScore(99.9);

      // Refresh balance
      apiClient.get('/accounts/me').then(r => setAccount(r.data));
    } catch (error) {
      const status = error.response?.status;
      const data = error.response?.data;
      const detail = data?.detail || 'Transfer blocked by security policy.';
      const blockReason = error.response?.headers?.['x-block-reason'];

      if (status === 403 && blockReason === 'EMERGENCY_KILL_SWITCH') {
        setFraudBlock({
          decision: 'KILL SWITCH',
          rules: ['emergency_kill_switch'],
          riskScore: 1.0,
          detail,
          transferId: null,
        });
        toast.error('🚨 KILL SWITCH ACTIVE', {
          description: 'All outgoing payments are suspended. Deactivate from UPI Safety settings.',
          duration: 10000,
          style: { background: '#1c1917', border: '2px solid #ef4444', color: '#fef2f2' },
        });
      } else if (status === 403 && (blockReason === 'ANNUAL_LIMIT_FROZEN' || blockReason === 'ANNUAL_LIMIT_EXCEEDED')) {
        setFraudBlock({
          decision: 'ANNUAL LIMIT',
          rules: ['annual_receiving_limit'],
          riskScore: 1.0,
          detail,
          transferId: null,
        });
        toast.error('📊 Annual Receiving Limit Breached', {
          description: detail,
          duration: 10000,
          style: { background: '#1c1917', border: '2px solid #f59e0b', color: '#fef3c7' },
        });
      } else if (status === 403) {
        const decision = data?.decision || 'BLOCK';
        const rules = data?.rules_triggered || [];
        const riskScore = data?.risk_score || 1.0;

        setFraudBlock({
          decision,
          rules,
          riskScore,
          detail,
          transferId: data?.transfer_id || null,
        });
        setTrustScore(Math.max(5, (1 - riskScore) * 100));

        const ruleNames = rules.length > 0
          ? rules.map(r => r.replace(/_/g, ' ')).join(', ')
          : 'security policy violation';

        toast.error(`🚨 Transfer Blocked — ${ruleNames}`, {
          description: detail,
          duration: 12000,
          style: { background: '#1c1917', border: '2px solid #ef4444', color: '#fef2f2' },
        });
      } else if (status === 401 && detail === 'Step-Up Authentication Required') {
        // Intercept deferred transfer — show PIN modal
        const challengeId = error.response.headers?.['x-auth-challenge-id'];
        // We need the transfer_id. The backend saved the transfer in PENDING_AUTH state.
        // The challenge ID header carries the auth_challenge_id; we need the transfer_id.
        // Since the 401 is raised AFTER db.commit, we can find it by querying recent transfers.
        // But simpler: let's extract transfer_id from error response if available,
        // or search for the pending transfer.
        try {
          const pendingRes = await apiClient.get('/transfers/history/all?limit=1');
          const pending = pendingRes.data?.find(t => t.status === 'PENDING_AUTH');
          if (pending) {
            setStepUpChallenge({ transferId: pending.id });
            toast.warning('🔐 Step-Up Authentication Required', {
              description: 'This transaction requires PIN verification to proceed.',
              duration: 5000,
              style: { background: '#1c1917', border: '2px solid #6366f1', color: '#e0e7ff' },
            });
          } else {
            toast.error('Step-Up Auth required but could not locate pending transfer.');
          }
        } catch {
          toast.error('Step-Up Auth required but failed to locate pending transfer.');
        }
      } else if (status === 400) {
        toast.error(detail || 'Transfer failed — insufficient balance or invalid input.');
      } else {
        toast.error(detail || 'Transfer failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
      setIsScanning(false);
    }
  };

  const handleStepUpSuccess = (completedTransfer) => {
    setStepUpChallenge(null);
    toast.success('✅ Step-Up Authentication Verified — Funds Released!', {
      duration: 5000,
      style: { background: '#1c1917', border: '2px solid #22c55e', color: '#dcfce7' },
    });
    setFormData({ receiver: '', amount: '', reference: '', ip_override: '' });
    setTrustScore(99.9);
    apiClient.get('/accounts/me').then(r => setAccount(r.data)).catch(() => {});
  };

    const dismissFraudBlock = () => setFraudBlock(null);

  // ── Pause Confirmation / Cancel handlers ──
  const handleConfirmPause = async () => {
    if (!pausedTransfer) return;
    setConfirmingPause(true);
    try {
      await apiClient.post(`/transfers/${pausedTransfer.transferId}/confirm-pause`);
      toast.success('✅ Paused transaction confirmed — Funds released!', {
        duration: 5000,
        style: { background: '#1c1917', border: '2px solid #22c55e', color: '#dcfce7' },
      });
      setPausedTransfer(null);
      setFormData({ receiver: '', amount: '', reference: '', ip_override: '' });
      apiClient.get('/accounts/me').then(r => setAccount(r.data)).catch(() => {});
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to confirm paused transaction');
    } finally { setConfirmingPause(false); }
  };

  const handleCancelPause = async () => {
    if (!pausedTransfer) return;
    try {
      await apiClient.post(`/transfers/${pausedTransfer.transferId}/cancel-pause`);
      toast.success('Transaction cancelled — No funds were moved.', { duration: 5000 });
      setPausedTransfer(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to cancel');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out pb-20">
      {/* Paused Transfer Confirmation Modal */}
      {pausedTransfer && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0c0c0d] border border-amber-500/30 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6 animate-in zoom-in-95 duration-300">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-amber-500 text-3xl">pause_circle</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-zinc-900 dark:text-white">Transaction Paused</h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">UPI Safety Rule 1</p>
              </div>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">{pausedTransfer.detail}</p>
            <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
              <p className="text-xs text-amber-600 dark:text-amber-400 font-bold">⏱ You have {Math.floor(pausedTransfer.cooldown / 60)} minutes to confirm or cancel this transaction.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleCancelPause}
                className="flex-1 py-3 bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-300 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-white/10 transition-all">
                Cancel Transfer
              </button>
              <button onClick={handleConfirmPause} disabled={confirmingPause}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-50">
                {confirmingPause ? 'Processing...' : 'Confirm & Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guardian Pending Notification */}
      {guardianPending && (
        <div className="relative animate-in fade-in zoom-in-95 duration-300">
          <div className="p-6 bg-violet-500/5 border-2 border-violet-500/30 rounded-3xl space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-violet-500 text-3xl">supervised_user_circle</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-violet-500 uppercase tracking-tight">Awaiting Guardian Approval</h3>
                  <p className="text-xs text-zinc-500 font-bold mt-0.5">{guardianPending.message}</p>
                </div>
              </div>
              <button onClick={() => setGuardianPending(null)} className="text-zinc-400 hover:text-zinc-600 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="text-[9px] font-mono text-zinc-400">Transfer ID: {guardianPending.transferId}</p>
          </div>
        </div>
      )}

      {/* Step-Up Authentication PIN Modal */}
      {stepUpChallenge && (
        <AuthModal
          transferId={stepUpChallenge.transferId}
          onSuccess={handleStepUpSuccess}
          onCancel={() => setStepUpChallenge(null)}
        />
      )}

      <div className="px-2">
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tighter text-zinc-900 dark:text-white">Capital Routing</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-lg leading-relaxed">
          Execute external transfers protected by real-time rule-based heuristics and SHA-256 audit chaining.
        </p>
      </div>

      {/* ═══ FRAUD BLOCK ALERT ═══ */}
      {fraudBlock && (
        <div className="relative animate-in fade-in zoom-in-95 duration-300">
          <div className="p-6 bg-red-500/5 border-2 border-red-500/30 rounded-3xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-red-500 text-3xl">gpp_bad</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-red-500 uppercase tracking-tight">Sentinel Security Block</h3>
                  <p className="text-xs text-zinc-500 font-bold mt-0.5">{fraudBlock.detail}</p>
                </div>
              </div>
              <button onClick={dismissFraudBlock} className="text-zinc-400 hover:text-zinc-600 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white dark:bg-black/50 rounded-2xl border border-red-500/10">
                <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-black">Decision</span>
                <p className="text-2xl font-black text-red-500 mt-1">{fraudBlock.decision}</p>
              </div>
              <div className="p-4 bg-white dark:bg-black/50 rounded-2xl border border-red-500/10">
                <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-black">Risk Score</span>
                <p className="text-2xl font-black text-red-500 font-mono mt-1">{((fraudBlock.riskScore || 0) * 100).toFixed(1)}%</p>
              </div>
              <div className="p-4 bg-white dark:bg-black/50 rounded-2xl border border-red-500/10 col-span-2">
                <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-black">Security Rules Triggered</span>
                <div className="flex flex-col gap-2 mt-3">
                  {fraudBlock.rules.filter(r => typeof r === 'string').map((rule, i) => {
                    const descriptions = {
                      // Layer 1 — Regulatory Hard Blocks
                      'RTGS_MINIMUM_FLOOR': 'RTGS transfers require a minimum payload of ₹2,00,000.',
                      'DAILY_VELOCITY_NPCI': 'Exceeded NPCI daily limit of 20 outbound transfers in 24 hours.',
                      'NEW_BENEFICIARY_COOLING_OFF': 'Transfers to new/unsaved beneficiaries are capped at ₹50,000 during the first 24 hours.',
                      'DAILY_VOLUME_NPCI': 'Exceeded NPCI daily volume limit of ₹1,00,000.',
                      // Layer 2 — Heuristic Scoring Rules
                      'burst_velocity': 'Multiple rapid transfers detected — 3+ transactions within 60 seconds from your account.',
                      'velocity': 'Too many transfers in a short time window — exceeds velocity threshold.',
                      'amount_threshold': 'Transfer amount exceeds the configured single-transaction limit.',
                      'amount_anomaly': 'Transfer amount is significantly higher than your usual transaction pattern.',
                      'daily_volume': 'Cumulative daily outflow has exceeded the configured volume limit.',
                      'new_account': 'Account is too new to execute high-value transactions.',
                      'account_age': 'Account is less than 48 hours old — high-value transfers are restricted.',
                      'time_of_day': 'High-value transfer attempted during off-hours (midnight – 5 AM IST).',
                      'geo_velocity': 'Physically impossible location change detected between recent transfers.',
                      'impossible_travel': 'Your current location is geographically impossible given your last transaction location — possible account compromise.',
                      'recipient_concentration': 'Repeated transfers to the same recipient in quick succession.',
                      // Layer 3 — Domain-Specific Anomalies
                      'SMURFING_SPLIT_STRUCTURING': 'Multiple transfers near ₹20,000 to the same recipient within 10 minutes — potential structuring detected.',
                      'ACCOUNT_DRAIN_PREDICTION': 'This transfer would drain over 95% of your balance to a new beneficiary.',
                    };
                    return (
                      <div key={i} className="flex items-start gap-3 p-3 bg-red-500/5 rounded-xl border border-red-500/10">
                        <span className="material-symbols-outlined text-red-500 text-[18px] mt-0.5 shrink-0">gpp_maybe</span>
                        <div>
                          <p className="text-xs font-black text-red-500 uppercase tracking-wide">{rule.replace(/_/g, ' ')}</p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 leading-relaxed">
                            {descriptions[rule] || 'This rule was triggered by the security engine.'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {fraudBlock.transferId && (
              <p className="text-[9px] font-mono text-zinc-400 mt-2">
                Flagged Transfer ID: {fraudBlock.transferId}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Transfer Action */}
        <section className="lg:col-span-12 xl:col-span-5 relative">
          <div className="bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-3xl p-6 md:p-10 shadow-xl dark:shadow-none space-y-10 relative z-10 transition-all hover:border-indigo-500/20">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 font-black mb-1 block">Commit Block</span>
                <h3 className="text-2xl font-black text-zinc-900 dark:text-white leading-tight tracking-tight">Instant Settlement</h3>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[9px] uppercase font-bold text-zinc-400">Available Balance</span>
                <span className="text-lg font-mono font-bold text-emerald-500">
                  {account ? formatINR(account.balance, true) : '---'}
                </span>
              </div>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-zinc-500 dark:text-zinc-400 font-black uppercase tracking-[0.1em]">Destination Identity (UUID)</label>
                  <DirectoryPopover onSelect={(id) => setFormData({...formData, receiver: id})} />
                </div>
                <div className="relative flex items-center">
                   <span className="material-symbols-outlined absolute left-4 text-zinc-400 text-xl pointer-events-none">fingerprint</span>
                   <input
                     type="text"
                     value={formData.receiver}
                     onChange={e => setFormData({...formData, receiver: e.target.value})}
                     required
                     className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-2xl pl-12 pr-4 py-4 text-sm font-mono outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-zinc-900 dark:text-white"
                     placeholder="ACC-xxxx-xxxx"
                   />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-zinc-500 dark:text-zinc-400 font-black uppercase tracking-[0.1em]">Capital Payload (INR)</label>
                <div className="relative flex items-center group">
                  <span className="absolute left-5 text-zinc-400 font-mono font-bold">₹</span>
                  <input
                    type="number" step="0.01" min="1"
                    value={formData.amount}
                    onChange={e => setFormData({...formData, amount: e.target.value})}
                    required
                    className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-2xl pl-10 pr-16 py-4 text-lg font-mono font-bold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-zinc-900 dark:text-white"
                    placeholder="0.00"
                  />
                  <div className="absolute right-3 px-3 py-1.5 bg-zinc-200/50 dark:bg-white/10 rounded-xl text-[10px] font-black text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">INR</div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-zinc-500 dark:text-zinc-400 font-black uppercase tracking-[0.1em]">Ledger Reference (Audit Memo)</label>
                <input
                  type="text"
                  value={formData.reference}
                  onChange={e => setFormData({...formData, reference: e.target.value})}
                  className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-2xl px-5 py-4 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-zinc-900 dark:text-white"
                  placeholder="Internal settlement ref..."
                />
              </div>

              <div className="space-y-2 mt-4 pt-4 border-t border-zinc-200 dark:border-white/5">
                <label className="text-[10px] text-zinc-500 dark:text-zinc-400 font-black uppercase tracking-[0.1em] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px] text-amber-500">language</span>
                  Geo-Origin Simulation
                </label>
                <select
                  value={formData.ip_override}
                  onChange={e => setFormData({...formData, ip_override: e.target.value})}
                  className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-2xl px-5 py-4 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-zinc-900 dark:text-white appearance-none"
                >
                  <option value="">Default — Local Network (Maharashtra)</option>
                  <option value="10.1.0.1">🏙️ Delhi (10.1.0.1)</option>
                  <option value="10.2.0.1">🏙️ Karnataka (10.2.0.1)</option>
                  <option value="10.3.0.1">🏙️ Tamil Nadu (10.3.0.1)</option>
                  <option value="10.4.0.1">🏙️ West Bengal (10.4.0.1)</option>
                  <option value="10.5.0.1">🏙️ Telangana (10.5.0.1)</option>
                  <option value="172.16.0.1">🌏 Singapore (172.16.0.1)</option>
                  <option value="172.18.0.1">🌍 London (172.18.0.1)</option>
                  <option value="172.19.0.1">🌎 New York (172.19.0.1)</option>
                </select>
                <p className="text-[9px] text-zinc-400 pl-1">Triggers Impossible Travel detection when switching cities between transfers</p>
              </div>

              <button
                type="submit"
                disabled={isLoading || !formData.receiver || !formData.amount}
                className="w-full mt-4 py-5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xl shadow-indigo-500/20 font-black uppercase tracking-widest rounded-2xl text-[11px] transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-3 group overflow-hidden relative"
              >
                {isLoading ? (
                  <span className="flex items-center gap-3"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Verifying Audit Chain...</span>
                ) : (
                  <>Execute Ledger Commit <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span></>
                )}
                {isScanning && <div className="absolute inset-0 bg-white/20 animate-pulse"></div>}
              </button>
            </form>
          </div>
        </section>

        {/* Defensive Radar Readout */}
        <section className="lg:col-span-7 h-full">
          <div className="bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-3xl h-full min-h-[460px] flex flex-col overflow-hidden shadow-sm dark:shadow-none bg-[radial-gradient(ellipse_at_top_right,rgba(79,70,229,0.05)_0%,transparent_50%)]">
            <div className="p-8 flex items-center justify-between border-b border-zinc-100 dark:border-white/5 relative z-10">
              <div>
                <h3 className="text-sm font-black text-zinc-800 dark:text-white flex items-center gap-2 uppercase tracking-tight">
                   <span className="material-symbols-outlined text-indigo-500 text-[18px]">policy</span> Active Defensive Posture
                </h3>
                <p className="text-[10px] text-zinc-500 mt-1">Real-time behavior analysis enabled</p>
              </div>
              <div className={`px-4 py-1.5 rounded-full flex items-center gap-2 border ${
                fraudBlock
                  ? 'bg-red-500/10 border-red-500/20 text-red-500'
                  : isScanning
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
              }`}>
                 <span className={`w-2 h-2 rounded-full ${
                   fraudBlock ? 'bg-red-500 animate-pulse' : isScanning ? 'bg-amber-500 animate-ping' : 'bg-emerald-500 animate-pulse'
                 }`}></span>
                 <span className="text-[10px] font-black uppercase tracking-widest">
                   {fraudBlock ? 'Threat Blocked' : isScanning ? 'Analyzing Payload' : 'Heuristics Armed'}
                 </span>
              </div>
            </div>

            <div className="flex-grow relative flex items-center justify-center p-12">
               {/* Synthetic Radar Geometry */}
               <div className="relative w-full max-w-[320px] aspect-square flex items-center justify-center isolate">
                  <div className="absolute inset-0 border border-zinc-200 dark:border-white/10 rounded-full"></div>
                  <div className="absolute inset-[20%] border border-zinc-200 dark:border-white/10 rounded-full"></div>
                  <div className="absolute inset-[40%] border border-zinc-200 dark:border-white/10 rounded-full"></div>
                  <div className="absolute inset-[60%] border border-zinc-200 dark:border-white/10 rounded-full"></div>

                  <div className={`absolute inset-0 rounded-full ${
                    fraudBlock
                      ? 'bg-[conic-gradient(from_0deg_at_50%_50%,rgba(239,68,68,0)_0deg,rgba(239,68,68,0.25)_360deg)] animate-spin [animation-duration:0.8s]'
                      : isScanning
                        ? 'bg-[conic-gradient(from_0deg_at_50%_50%,rgba(79,70,229,0)_0deg,rgba(79,70,229,0.15)_360deg)] animate-spin [animation-duration:1s]'
                        : 'bg-[conic-gradient(from_0deg_at_50%_50%,rgba(79,70,229,0)_0deg,rgba(79,70,229,0.15)_360deg)] animate-spin [animation-duration:6s]'
                  }`}></div>

                  <div className="absolute w-[120%] h-[1px] bg-zinc-200 dark:bg-white/10 -rotate-45"></div>
                  <div className="absolute w-[120%] h-[1px] bg-zinc-200 dark:bg-white/10 rotate-45"></div>

                  <svg className={`absolute w-[80%] h-[80%] fill-current drop-shadow-[0_0_25px_rgba(79,70,229,0.4)] transition-all duration-1000 ${fraudBlock ? 'text-red-500/30' : 'text-indigo-500/20'}`} viewBox="0 0 100 100">
                    <polygon points="50,15 85,40 70,85 30,85 15,40" />
                  </svg>

                  <div className={`w-4 h-4 rounded-full shadow-[0_0_30px] z-10 absolute transition-all duration-500 ${
                    fraudBlock
                      ? 'bg-red-500 shadow-red-500 scale-150 blur-sm'
                      : isScanning
                        ? 'bg-indigo-500 shadow-indigo-500 scale-150 blur-sm'
                        : 'bg-indigo-500 shadow-indigo-500 scale-100'
                  }`}></div>
               </div>
            </div>

            <div className="p-6 grid grid-cols-3 divide-x divide-zinc-200 dark:divide-white/5 border-t border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-[#0c0c0d]">
               <div className="px-6 flex flex-col items-center text-center">
                  <span className={`text-2xl font-mono font-black tabular-nums transition-colors ${trustScore < 50 ? 'text-red-500' : 'text-zinc-900 dark:text-white'}`}>{trustScore.toFixed(1)}%</span>
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-black mt-1">Trust Score</span>
               </div>
               <div className="px-6 flex flex-col items-center text-center">
                  <span className="text-2xl font-mono font-black text-zinc-900 dark:text-white tabular-nums">{'<'}{isScanning ? '2' : '15'}ms</span>
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-black mt-1">Analysis Latency</span>
               </div>
               <div className="px-6 flex flex-col items-center text-center">
                  <span className={`text-2xl font-mono font-black ${fraudBlock ? 'text-red-500' : trustScore < 50 ? 'text-red-500' : 'text-emerald-500 animate-pulse'}`}>
                    {fraudBlock ? 'BLOCKED' : trustScore < 50 ? 'BLOCKED' : 'PASSED'}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-black mt-1">Velocity Limit</span>
               </div>
            </div>
          </div>
        </section>
      </div>

      {/* ═══ WHITELISTED CONTACTS ═══ */}
      <section>
        <div className="bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-3xl shadow-sm overflow-hidden">
          <button
            onClick={() => setShowWhitelist(!showWhitelist)}
            className="w-full p-6 flex items-center justify-between hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-emerald-500 text-xl">how_to_reg</span>
              </div>
              <div className="text-left">
                <h3 className="text-sm font-black text-zinc-900 dark:text-white tracking-tight">Whitelisted Contacts</h3>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                  {whitelist.length} saved · Quick fill recipient
                </p>
              </div>
            </div>
            <span className={`material-symbols-outlined text-zinc-400 transition-transform ${showWhitelist ? 'rotate-180' : ''}`}>
              expand_more
            </span>
          </button>

          {showWhitelist && (
            <div className="px-6 pb-6 space-y-4 border-t border-zinc-100 dark:border-white/5 pt-4 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Add New Contact */}
              <div className="flex flex-col sm:flex-row gap-3">
                <input type="text" value={wlAccountId} onChange={e => setWlAccountId(e.target.value)}
                  placeholder="Account ID to whitelist"
                  className="flex-1 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm font-mono outline-none focus:border-emerald-500 transition-all" />
                <input type="text" value={wlNickname} onChange={e => setWlNickname(e.target.value)}
                  placeholder="Nickname (optional)"
                  className="sm:w-40 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500 transition-all" />
                <button onClick={async () => {
                  if (!wlAccountId.trim()) return;
                  try {
                    await apiClient.post('/whitelist', { contact_account_id: wlAccountId, nickname: wlNickname || null });
                    toast.success('Contact whitelisted');
                    setWlAccountId(''); setWlNickname('');
                    fetchWhitelist();
                  } catch (err) { toast.error(err.response?.data?.detail || 'Failed to add'); }
                }}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shrink-0">
                  <span className="material-symbols-outlined text-sm">person_add</span> Add
                </button>
              </div>

              {/* Contact List */}
              {whitelist.length === 0 ? (
                <div className="p-8 text-center">
                  <span className="material-symbols-outlined text-4xl text-zinc-300 dark:text-zinc-600">group_off</span>
                  <p className="text-xs text-zinc-400 mt-3 font-bold uppercase tracking-widest">No whitelisted contacts</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-white/5">
                  {whitelist.map(c => (
                    <div key={c.id} className="flex items-center justify-between py-3 group">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center">
                          <span className="material-symbols-outlined text-emerald-500 text-lg">person</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{c.nickname || 'Unnamed Contact'}</p>
                          <p className="text-[10px] font-mono text-zinc-400 mt-0.5">{c.contact_account_id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setFormData({...formData, receiver: c.contact_account_id})}
                          className="px-3 py-1.5 bg-indigo-500/10 text-indigo-500 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500/20 transition-all">
                          Quick Fill
                        </button>
                        <button onClick={async () => {
                          try { await apiClient.delete(`/whitelist/${c.id}`); toast.success('Removed'); fetchWhitelist(); }
                          catch (e) { toast.error('Failed to remove'); }
                        }}
                          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 transition-all p-2 hover:bg-red-500/5 rounded-xl">
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function DirectoryPopover({ onSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const [directory, setDirectory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');

  const fetchDirectory = async (query = '') => {
    setIsLoading(true);
    try {
      const res = await apiClient.get(`/accounts/directory${query ? `?query=${query}` : ''}`);
      setDirectory(res.data);
    } catch (err) {
      console.error('Directory fetch failed', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => fetchDirectory(search), 300);
      return () => clearTimeout(timer);
    }
  }, [search, isOpen]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchDirectory();
        }}
        className="text-[10px] bg-zinc-100 dark:bg-zinc-800 hover:bg-indigo-500/10 hover:text-indigo-500 px-3 py-1 rounded-lg font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-zinc-200 dark:border-white/10"
      >
        <span className="material-symbols-outlined text-[14px]">search</span> Discover
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute right-0 top-8 w-64 md:w-80 bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
            <div className="p-4 border-b border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-white/5 space-y-3">
               <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Network Directory</span>
                  {isLoading && <span className="w-3 h-3 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></span>}
               </div>
               <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[14px]">search</span>
                  <input
                    type="text"
                    placeholder="Search by username..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-lg pl-8 pr-3 py-1.5 text-[11px] outline-none focus:border-indigo-500 transition-all font-bold"
                  />
               </div>
            </div>
            <div className="max-h-64 overflow-y-auto p-2 space-y-1 scrollbar-hide">
               {directory.length === 0 && !isLoading ? (
                 <div className="p-8 text-center text-[10px] text-zinc-400 uppercase font-bold tracking-widest">No nodes found</div>
               ) : (
                 directory.map(node => (
                   <button
                     key={node.account_id}
                     type="button"
                     onClick={() => {
                       onSelect(node.account_id);
                       setIsOpen(false);
                     }}
                     className="w-full p-3 rounded-xl text-left hover:bg-indigo-500/10 group transition-all"
                   >
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                           <span className="material-symbols-outlined text-[18px]">account_balance</span>
                        </div>
                        <div className="min-w-0">
                           <p className="text-xs font-black text-zinc-800 dark:text-zinc-200 truncate uppercase mt-1">{node.username}</p>
                           <p className="text-[9px] font-mono text-zinc-400 truncate mt-1">{node.account_id}</p>
                        </div>
                     </div>
                   </button>
                 ))
               )}
            </div>
            <div className="p-3 bg-zinc-50/50 dark:bg-white/5 border-t border-zinc-100 dark:border-white/5 text-center">
               <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">Internal Dev Access Only</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
