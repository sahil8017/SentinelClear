import React, { useState, useEffect } from 'react';
import apiClient from '../lib/axios';
import { toast } from 'sonner';
import { formatINR } from '../lib/format';

export function Transfer() {
  const [formData, setFormData] = useState({
    receiver: '',
    amount: '',
    reference: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [account, setAccount] = useState(null);
  const [trustScore, setTrustScore] = useState(99.8);
  const [isScanning, setIsScanning] = useState(false);
  const [fraudBlock, setFraudBlock] = useState(null); // Holds the fraud block details

  useEffect(() => {
    apiClient.get('/accounts/me')
      .then(res => setAccount(res.data))
      .catch(err => console.error('Account sync failure', err));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.receiver || !formData.amount) return;

    setIsLoading(true);
    setIsScanning(true);
    setFraudBlock(null);

    // Brief "scanning" delay for the radar animation
    await new Promise(r => setTimeout(r, 800));

    try {
      const res = await apiClient.post('/transfers', {
        receiver_account_id: formData.receiver,
        amount: parseFloat(formData.amount),
        currency: 'INR',
        reference: formData.reference || 'Network Transfer'
      });

      toast.success('Funds securely transferred & audited.');
      setFormData({ receiver: '', amount: '', reference: '' });
      setTrustScore(99.9);

      // Refresh balance
      apiClient.get('/accounts/me').then(r => setAccount(r.data));
    } catch (error) {
      const status = error.response?.status;
      const data = error.response?.data;
      const detail = data?.detail || 'Transfer blocked by security policy.';

      if (status === 403) {
        // Could be Layer 1 (hard regulatory block with just `detail`)
        // or Layer 2 (predictive with `decision`, `rules_triggered`, `risk_score`)
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

        toast.error(`🚨 TRANSFER BLOCKED`, {
          description: detail,
          duration: 10000,
          style: { background: '#1c1917', border: '2px solid #ef4444', color: '#fef2f2' },
        });
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

  const dismissFraudBlock = () => setFraudBlock(null);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out pb-20">
      <div className="px-2">
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tighter text-zinc-900 dark:text-white">Capital Routing</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-lg leading-relaxed">
          Execute external transfers protected by real-time ML-velocity heuristics and SHA-256 audit chaining.
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-white dark:bg-black/50 rounded-2xl border border-red-500/10">
                <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-black">Decision</span>
                <p className="text-2xl font-black text-red-500 mt-1">{fraudBlock.decision}</p>
              </div>
              <div className="p-4 bg-white dark:bg-black/50 rounded-2xl border border-red-500/10">
                <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-black">Risk Score</span>
                <p className="text-2xl font-black text-red-500 font-mono mt-1">{((fraudBlock.riskScore || 0) * 100).toFixed(1)}%</p>
              </div>
              <div className="p-4 bg-white dark:bg-black/50 rounded-2xl border border-red-500/10">
                <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-black">Rules Triggered</span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {fraudBlock.rules.map((rule, i) => (
                    <span key={i} className="px-2 py-0.5 bg-red-500/10 text-red-500 rounded-md text-[9px] font-black uppercase tracking-wider">
                      {rule.replace(/_/g, ' ')}
                    </span>
                  ))}
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
