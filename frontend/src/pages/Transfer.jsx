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

      if (res.status === 202) {
        const data = res.data;
        if (data.status === 'PAUSED') {
          setPausedTransfer({
            transferId: data.transfer_id,
            cooldown: data.cooldown_seconds,
            detail: data.detail,
          });
          toast.warning('Transaction Paused', { description: data.detail });
        } else if (data.status === 'PENDING_GUARDIAN') {
          setGuardianPending({
            transferId: data.transfer_id,
            message: data.message,
          });
          toast.info('Guardian Approval Required', { description: data.message });
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
        toast.error('KILL SWITCH ACTIVE', { description: 'All outgoing payments are suspended.' });
      } else if (status === 403 && (blockReason === 'ANNUAL_LIMIT_FROZEN' || blockReason === 'ANNUAL_LIMIT_EXCEEDED')) {
        setFraudBlock({
          decision: 'ANNUAL LIMIT',
          rules: ['annual_receiving_limit'],
          riskScore: 1.0,
          detail,
          transferId: null,
        });
        toast.error('Annual Receiving Limit Breached', { description: detail });
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

        const ruleNames = rules.length > 0 ? rules.map(r => r.replace(/_/g, ' ')).join(', ') : 'security policy violation';
        toast.error(`Transfer Blocked — ${ruleNames}`, { description: detail });
      } else if (status === 401 && detail === 'Step-Up Authentication Required') {
        try {
          const pendingRes = await apiClient.get('/transfers/history/all?limit=1');
          const pending = pendingRes.data?.find(t => t.status === 'PENDING_AUTH');
          if (pending) {
            setStepUpChallenge({ transferId: pending.id });
            toast.warning('Step-Up Authentication Required', { description: 'This transaction requires PIN verification.' });
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
    toast.success('Step-Up Authentication Verified — Funds Released!');
    setFormData({ receiver: '', amount: '', reference: '', ip_override: '' });
    setTrustScore(99.9);
    apiClient.get('/accounts/me').then(r => setAccount(r.data)).catch(() => {});
  };

  const dismissFraudBlock = () => setFraudBlock(null);

  const handleConfirmPause = async () => {
    if (!pausedTransfer) return;
    setConfirmingPause(true);
    try {
      await apiClient.post(`/transfers/${pausedTransfer.transferId}/confirm-pause`);
      toast.success('Paused transaction confirmed — Funds released!');
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
      toast.success('Transaction cancelled — No funds were moved.');
      setPausedTransfer(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to cancel');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      
      {/* Paused Transfer Confirmation Modal */}
      {pausedTransfer && (
        <div className="fixed inset-0 bg-[#0A2540]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-[#e3e8ee] rounded-[16px] p-6 md:p-8 max-w-md w-full shadow-[0_8px_30px_rgba(0,0,0,0.12)] space-y-6 zoom-in-95 duration-300">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded bg-[#ff6118]/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[#ff6118] text-2xl">pause_circle</span>
              </div>
              <div>
                <h3 className="text-[18px] font-semibold text-[#0A2540]">Transaction Paused</h3>
                <p className="text-[12px] text-[#6B7C93] font-medium mt-0.5">UPI Safety Rule Triggered</p>
              </div>
            </div>
            <p className="text-[14px] text-[#425466] leading-[1.6]">{pausedTransfer.detail}</p>
            <div className="p-3 bg-[#fff5f2] border border-[#ffe0d4] rounded-[8px]">
              <p className="text-[13px] text-[#ff6118] font-medium">⏱ Confirm or cancel within {Math.floor(pausedTransfer.cooldown / 60)} minutes.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={handleCancelPause}
                className="w-full py-2.5 bg-white border border-[#e3e8ee] text-[#425466] hover:bg-[#f6f9fc] rounded text-[14px] font-medium transition-colors">
                Cancel Transfer
              </button>
              <button onClick={handleConfirmPause} disabled={confirmingPause}
                className="w-full py-2.5 bg-[#0A2540] hover:bg-[#112F4E] text-white rounded text-[14px] font-medium transition-colors disabled:opacity-50">
                {confirmingPause ? 'Processing...' : 'Confirm & Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guardian Pending Notification */}
      {guardianPending && (
        <div className="p-5 bg-white border border-[#e3e8ee] shadow-[0_2px_5px_rgba(0,0,0,0.02)] rounded-[12px] space-y-3 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#635BFF]"></div>
          <div className="flex items-start justify-between pl-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-[#635BFF]/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#635BFF] text-xl">supervised_user_circle</span>
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-[#0A2540]">Awaiting Guardian Approval</h3>
                <p className="text-[13px] text-[#6B7C93] font-medium mt-0.5">{guardianPending.message}</p>
              </div>
            </div>
            <button onClick={() => setGuardianPending(null)} className="text-[#6B7C93] hover:text-[#0A2540] transition-colors">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
          <p className="text-[11px] font-mono text-[#6B7C93] pl-2">Transfer ID: {guardianPending.transferId}</p>
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

      <div>
        <h1 className="text-[32px] md:text-[40px] font-light tracking-tight text-[#0A2540] m-0">Transfer Funds</h1>
        <p className="text-[15px] text-[#425466] mt-2 max-w-xl leading-[1.6]">
          Send capital securely across the network. All transactions are monitored by the real-time heuristic scoring engine.
        </p>
      </div>

      {/* FRAUD BLOCK ALERT */}
      {fraudBlock && (
        <div className="p-6 bg-[#fff5f5] border border-[#ffcdcd] rounded-[12px] space-y-5 animate-in zoom-in-95 duration-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded bg-[#df1b41]/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[#df1b41] text-xl">gpp_bad</span>
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-[#df1b41]">Security Block Enforced</h3>
                <p className="text-[13px] text-[#df1b41]/80 mt-0.5">{fraudBlock.detail}</p>
              </div>
            </div>
            <button onClick={dismissFraudBlock} className="text-[#df1b41] hover:bg-[#df1b41]/10 p-1 rounded transition-colors">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded border border-[#ffcdcd] shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <span className="text-[11px] uppercase font-bold tracking-wider text-[#df1b41]">Risk Score</span>
              <p className="text-[24px] font-light text-[#df1b41] mt-1">{((fraudBlock.riskScore || 0) * 100).toFixed(1)}%</p>
            </div>
            <div className="bg-white p-4 rounded border border-[#ffcdcd] shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <span className="text-[11px] uppercase font-bold tracking-wider text-[#df1b41]">Engine Decision</span>
              <p className="text-[24px] font-light text-[#df1b41] mt-1 uppercase">{fraudBlock.decision}</p>
            </div>
            <div className="bg-white p-4 rounded border border-[#ffcdcd] shadow-[0_1px_2px_rgba(0,0,0,0.02)] md:col-span-2">
              <span className="text-[11px] uppercase font-bold tracking-wider text-[#df1b41]">Rules Triggered</span>
              <div className="flex flex-col gap-2 mt-3">
                {fraudBlock.rules.filter(r => typeof r === 'string').map((rule, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-[#f6f9fc] rounded border border-[#e3e8ee]">
                    <span className="material-symbols-outlined text-[#df1b41] text-[16px] mt-0.5">gpp_maybe</span>
                    <div>
                      <p className="text-[12px] font-semibold text-[#0A2540] tracking-wide">{rule.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Transfer Action */}
        <section className="lg:col-span-12 xl:col-span-5 relative">
          <div className="bg-white border border-[#e3e8ee] rounded-[16px] p-6 lg:p-8 shadow-[0_2px_5px_rgba(0,0,0,0.02)] space-y-8 relative z-10">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-[20px] font-medium text-[#0A2540]">Create Transfer</h3>
                <p className="text-[13px] text-[#6B7C93] mt-1">Settle instantly via Ledger</p>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[11px] uppercase font-bold text-[#6B7C93]">Available</span>
                <span className="text-[16px] font-medium text-[#0CBF4C]">
                  {account ? formatINR(account.balance, true) : '---'}
                </span>
              </div>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[13px] font-medium text-[#0A2540]">Recipient Account (UUID)</label>
                  <DirectoryPopover onSelect={(id) => setFormData({...formData, receiver: id})} currentUserId={account?.id} />
                </div>
                <div className="relative flex items-center">
                   <span className="material-symbols-outlined absolute left-3.5 text-[#6B7C93] text-[18px] pointer-events-none">fingerprint</span>
                   <input
                     type="text"
                     value={formData.receiver}
                     onChange={e => setFormData({...formData, receiver: e.target.value})}
                     required
                     className="w-full bg-[#f6f9fc] focus:bg-white border border-[#e3e8ee] rounded-[8px] pl-10 pr-4 py-3 text-[14px] font-mono outline-none focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/20 transition-all text-[#0A2540]"
                     placeholder="ACC-xxxx-xxxx"
                   />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#0A2540]">Transfer Amount</label>
                <div className="relative flex items-center group">
                  <span className="absolute left-4 text-[#6B7C93] font-medium">₹</span>
                  <input
                    type="number" step="0.01" min="1"
                    value={formData.amount}
                    onChange={e => setFormData({...formData, amount: e.target.value})}
                    required
                    className="w-full bg-[#f6f9fc] focus:bg-white border border-[#e3e8ee] rounded-[8px] pl-8 pr-16 py-3 text-[16px] font-medium outline-none focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/20 transition-all text-[#0A2540]"
                    placeholder="0.00"
                  />
                  <div className="absolute right-3 text-[13px] font-medium text-[#6B7C93]">INR</div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#0A2540]">Memo (Optional)</label>
                <input
                  type="text"
                  value={formData.reference}
                  onChange={e => setFormData({...formData, reference: e.target.value})}
                  className="w-full bg-[#f6f9fc] focus:bg-white border border-[#e3e8ee] rounded-[8px] px-4 py-3 text-[14px] outline-none focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/20 transition-all text-[#0A2540]"
                  placeholder="Invoice or reference..."
                />
              </div>

              <div className="space-y-2 mt-4 pt-4 border-t border-[#e3e8ee]">
                <label className="text-[13px] font-medium text-[#0A2540] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-[#ff6118]">language</span>
                  Simulate Location (Testing)
                </label>
                <select
                  value={formData.ip_override}
                  onChange={e => setFormData({...formData, ip_override: e.target.value})}
                  className="w-full bg-[#f6f9fc] border border-[#e3e8ee] rounded-[8px] px-4 py-3 text-[14px] outline-none focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/20 transition-all text-[#0A2540]"
                >
                  <option value="">Default Network</option>
                  <option value="10.1.0.1">Delhi (10.1.0.1)</option>
                  <option value="10.2.0.1">Karnataka (10.2.0.1)</option>
                  <option value="172.16.0.1">Singapore (172.16.0.1)</option>
                  <option value="172.18.0.1">London (172.18.0.1)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isLoading || !formData.receiver || !formData.amount}
                className="w-full mt-4 py-3.5 bg-[#635BFF] hover:bg-[#5851db] text-white shadow-[0_2px_5px_rgba(99,91,255,0.3)] font-medium rounded-[8px] text-[15px] transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Connecting...</span>
                ) : (
                  <>Send Payment <span className="material-symbols-outlined text-[18px]">payment</span></>
                )}
              </button>
            </form>
          </div>
        </section>

        {/* Security / Whitelist Sidebar */}
        <section className="lg:col-span-12 xl:col-span-7 h-full space-y-6">
          
          <div className="bg-white border border-[#e3e8ee] rounded-[16px] p-6 shadow-[0_2px_5px_rgba(0,0,0,0.02)] flex flex-col items-center justify-center text-center">
             <div className="w-16 h-16 rounded-full bg-[#f6f9fc] border border-[#e3e8ee] flex items-center justify-center mb-4">
                <span className={`material-symbols-outlined text-[28px] ${trustScore < 50 ? 'text-[#df1b41]' : 'text-[#0CBF4C]'}`}>
                   {trustScore < 50 ? 'warning' : 'verified_user'}
                </span>
             </div>
             <h3 className="text-[20px] font-medium text-[#0A2540]">Network Trust Score</h3>
             <p className="text-[14px] text-[#425466] mt-1 max-w-sm">Every payment is analyzed. Maintain good behavior patterns to retain high limits.</p>
             <div className="text-[36px] font-light mt-4 text-[#0A2540]">{trustScore.toFixed(1)}%</div>
             {isScanning && <p className="text-[12px] text-[#635BFF] mt-2 animate-pulse font-medium">Computing risk metrics...</p>}
          </div>

          <div className="bg-white border border-[#e3e8ee] rounded-[16px] shadow-[0_2px_5px_rgba(0,0,0,0.02)] overflow-hidden">
            <button
              onClick={() => setShowWhitelist(!showWhitelist)}
              className="w-full p-6 flex items-center justify-between hover:bg-[#f6f9fc] transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-[#f6f9fc] border border-[#e3e8ee] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#0A2540] text-[20px]">contacts</span>
                </div>
                <div className="text-left">
                  <h3 className="text-[16px] font-medium text-[#0A2540]">Address Book</h3>
                  <p className="text-[13px] text-[#6B7C93] mt-0.5">{whitelist.length} saved beneficiaries</p>
                </div>
              </div>
              <span className={`material-symbols-outlined text-[#6B7C93] transition-transform ${showWhitelist ? 'rotate-180' : ''}`}>
                expand_more
              </span>
            </button>

            {showWhitelist && (
              <div className="px-6 pb-6 space-y-5 border-t border-[#e3e8ee] pt-5 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input type="text" value={wlAccountId} onChange={e => setWlAccountId(e.target.value)}
                    placeholder="Account ID (UUID)"
                    className="flex-1 bg-[#f6f9fc] focus:bg-white border border-[#e3e8ee] rounded-[8px] px-4 py-2.5 text-[14px] font-mono outline-none focus:border-[#635BFF] transition-all" />
                  <input type="text" value={wlNickname} onChange={e => setWlNickname(e.target.value)}
                    placeholder="Nickname"
                    className="sm:w-32 bg-[#f6f9fc] focus:bg-white border border-[#e3e8ee] rounded-[8px] px-4 py-2.5 text-[14px] outline-none focus:border-[#635BFF] transition-all" />
                  <button onClick={async () => {
                    if (!wlAccountId.trim()) return;
                    try {
                      await apiClient.post('/whitelist', { contact_account_id: wlAccountId, nickname: wlNickname || null });
                      toast.success('Contact added');
                      setWlAccountId(''); setWlNickname('');
                      fetchWhitelist();
                    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to add'); }
                  }}
                    className="px-5 py-2.5 bg-[#0A2540] hover:bg-[#112F4E] text-white font-medium rounded-[8px] text-[14px] transition-all whitespace-nowrap">
                    Add
                  </button>
                </div>

                {whitelist.length === 0 ? (
                  <div className="p-6 text-center bg-[#f6f9fc] border border-[#e3e8ee] rounded-[8px]">
                    <p className="text-[13px] text-[#6B7C93] font-medium">No saved beneficiaries</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#e3e8ee] border border-[#e3e8ee] rounded-[8px] bg-white">
                    {whitelist.map(c => (
                      <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 group gap-3 text-left">
                        <div className="flex flex-col min-w-0">
                          <p className="text-[14px] font-semibold text-[#0A2540] truncate">{c.nickname || 'Unnamed Contact'}</p>
                          <p className="text-[12px] font-mono text-[#6B7C93] mt-0.5 truncate">{c.contact_account_id}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => setFormData({...formData, receiver: c.contact_account_id})}
                            className="px-3 py-1.5 bg-[#f6f9fc] hover:bg-[#e3e8ee] text-[#0A2540] font-medium rounded-[6px] text-[12px] transition-all flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">edit_square</span> Fill
                          </button>
                          <button onClick={async () => {
                            try { await apiClient.delete(`/whitelist/${c.id}`); toast.success('Removed'); fetchWhitelist(); }
                            catch (e) { toast.error('Failed to remove'); }
                          }}
                            className="p-1.5 text-[#6B7C93] hover:bg-[#fff5f5] hover:text-[#df1b41] rounded-[6px] transition-all">
                            <span className="material-symbols-outlined text-[16px]">delete</span>
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

    </div>
  );
}

function DirectoryPopover({ onSelect, currentUserId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [directory, setDirectory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');

  const fetchDirectory = async (query = '') => {
    setIsLoading(true);
    try {
      const res = await apiClient.get(`/accounts/directory${query ? `?query=${query}` : ''}`);
      // Enforce strict frontend security filtering
      const filtered = res.data.filter(u => {
        const uId = u.id || u.account_id;
        return uId !== '00000000-0000-0000-0000-000000000000' && uId !== currentUserId;
      });
      setDirectory(filtered);
    } catch (err) {
      console.error('Directory fetch failed');
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
        className="text-[12px] text-[#635BFF] hover:text-[#0A2540] font-medium flex items-center gap-1 transition-colors"
      >
        <span className="material-symbols-outlined text-[14px]">search</span> Directory
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute right-0 top-6 w-[280px] md:w-[320px] bg-white border border-[#e3e8ee] rounded-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-3 border-b border-[#e3e8ee] bg-[#f6f9fc] space-y-3">
               <div className="relative">
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B7C93] text-[16px]">search</span>
                  <input
                    type="text"
                    placeholder="Search accounts..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-white border border-[#e3e8ee] rounded pl-8 pr-3 py-2 text-[13px] outline-none focus:border-[#635BFF] transition-all"
                  />
               </div>
            </div>
            <div className="max-h-[250px] overflow-y-auto p-1 scrollbar-hide">
               {directory.length === 0 && !isLoading ? (
                 <div className="p-6 text-center text-[12px] text-[#6B7C93]">No matching accounts</div>
               ) : (
                 directory.map(node => (
                   <button
                     key={node.account_id}
                     type="button"
                     onClick={() => {
                       onSelect(node.account_id);
                       setIsOpen(false);
                     }}
                     className="w-full p-3 rounded-[8px] text-left hover:bg-[#f6f9fc] transition-all"
                   >
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#e3e8ee] flex items-center justify-center shrink-0">
                           <span className="material-symbols-outlined text-[18px] text-[#425466]">account_circle</span>
                        </div>
                        <div className="min-w-0">
                           <p className="text-[13px] font-medium text-[#0A2540] truncate uppercase">{node.username}</p>
                           <p className="text-[11px] font-mono text-[#6B7C93] truncate">{node.account_id}</p>
                        </div>
                     </div>
                   </button>
                 ))
               )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
