import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../lib/axios';
import { toast } from 'sonner';
import { formatIST } from '../lib/format';

export function OpsDashboard() {
  const [rules, setRules] = useState([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [wsStatus, setWsStatus] = useState('connecting');
  const [pendingLoans, setPendingLoans] = useState([]);

  const fetchPendingLoans = useCallback(async () => {
    try {
      const res = await apiClient.get('/loans/admin/all');
      setPendingLoans(res.data.filter(l => l.status === 'PENDING'));
    } catch (err) {
      console.error('Failed to load loans', err);
    }
  }, []);

  const handleApproveLoan = async (loanId) => {
    try {
      await apiClient.post(`/loans/admin/${loanId}/approve`);
      toast.success('Loan Disbursed');
      fetchPendingLoans();
    } catch(e) {
      toast.error('Failed to approve loan');
    }
  };

  const handleRejectLoan = async (loanId) => {
    try {
      await apiClient.post(`/loans/admin/${loanId}/reject`);
      toast.success('Loan Rejected');
      fetchPendingLoans();
    } catch(e) {
      toast.error('Failed to reject loan');
    }
  };

  // Fetch real fraud rules from backend
  const fetchRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const res = await apiClient.get('/fraud/rules');
      setRules(res.data);
    } catch (err) {
      console.error('Failed to load fraud rules', err);
      toast.error('Failed to load heuristic parameters');
    } finally {
      setRulesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
    fetchPendingLoans();
  }, [fetchRules, fetchPendingLoans]);

  // WebSocket for live fraud alerts
  useEffect(() => {
    let ws;
    let reconnectTimeout;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const host = window.location.hostname;
      ws = new WebSocket(`${protocol}://${host}:8000/ws/fraud-alerts`);

      ws.onopen = () => {
        setWsStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setAlerts(prev => [{ ...data, timestamp: formatIST(new Date()) }, ...prev].slice(0, 15));
        } catch (e) {
          console.error('Invalid WS message', e);
        }
      };

      ws.onclose = () => {
        setWsStatus('disconnected');
        reconnectTimeout = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        setWsStatus('error');
      };
    };

    connect();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // Update a specific rule field
  const handleRuleChange = (ruleName, field, value) => {
    setRules(prev => prev.map(r =>
      r.rule_name === ruleName ? { ...r, [field]: value } : r
    ));
  };

  // Deploy all rule changes to backend
  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const results = await Promise.allSettled(
        rules.map(rule =>
          apiClient.put(`/fraud/rules/${rule.rule_name}`, {
            weight: rule.weight,
            enabled: rule.enabled,
            threshold_value: rule.threshold_value,
          })
        )
      );

      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        toast.warning(`${rules.length - failed.length}/${rules.length} rules deployed. ${failed.length} failed.`);
      } else {
        toast.success('All parameters deployed to consensus nodes.');
      }

      // Re-fetch to confirm
      await fetchRules();
    } catch (err) {
      toast.error('Failed to deploy parameters');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">Operations Matrix</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-lg">
          Dynamic runtime adjustments for SentinelClear logic flows. Modifications apply instantly to active ledger nodes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Rule Config Panel */}
        <div className="bg-white dark:bg-[#080808] border border-zinc-200 dark:border-white/5 rounded-2xl p-8 shadow-sm dark:shadow-none space-y-8">
          <div className="border-b border-zinc-100 dark:border-white/5 pb-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-1">Heuristic Parameters</h3>
            <p className="text-[11px] text-zinc-500 uppercase tracking-widest font-semibold">Adjust threshold models</p>
          </div>

          {rulesLoading ? (
            <div className="space-y-6">
              {[1,2,3,4].map(i => (
                <div key={i} className="space-y-3">
                  <div className="h-4 bg-zinc-100 dark:bg-white/5 animate-pulse rounded w-2/3"></div>
                  <div className="h-2 bg-zinc-100 dark:bg-white/5 animate-pulse rounded"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {rules.map((rule) => (
                <div key={rule.rule_name} className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRuleChange(rule.rule_name, 'enabled', !rule.enabled)}
                        className={`w-8 h-4 rounded-full transition-all relative ${rule.enabled ? 'bg-indigo-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                      >
                        <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${rule.enabled ? 'left-4.5 right-0.5' : 'left-0.5'}`}
                          style={{ left: rule.enabled ? 'calc(100% - 14px)' : '2px' }}
                        ></div>
                      </button>
                      <label className="text-[11px] uppercase tracking-widest text-zinc-600 dark:text-zinc-400 font-bold">
                        {rule.rule_name.replace(/_/g, ' ')}
                      </label>
                    </div>
                    <span className={`text-[12px] font-mono font-bold px-2.5 py-1 rounded-md ${
                      rule.enabled
                        ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10'
                        : 'text-zinc-400 bg-zinc-100 dark:bg-zinc-800'
                    }`}>
                      {rule.weight.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range" min="0" max="3" step="0.1"
                    value={rule.weight}
                    disabled={!rule.enabled}
                    onChange={(e) => handleRuleChange(rule.rule_name, 'weight', parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-zinc-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  />
                  {rule.threshold_value !== null && rule.threshold_value !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">Threshold:</span>
                      <input
                        type="number"
                        value={rule.threshold_value}
                        disabled={!rule.enabled}
                        onChange={(e) => handleRuleChange(rule.rule_name, 'threshold_value', parseFloat(e.target.value))}
                        className="w-24 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-md px-2 py-1 text-[11px] font-mono outline-none focus:border-indigo-500 disabled:opacity-30"
                      />
                    </div>
                  )}
                  {rule.description && (
                    <p className="text-[9px] text-zinc-400 font-medium">{rule.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleSaveConfig}
            disabled={isSaving || rulesLoading}
            className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-bold rounded-xl text-[12px] uppercase tracking-widest shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <><span className="w-4 h-4 border-2 border-white/30 dark:border-black/30 border-t-white dark:border-t-black rounded-full animate-spin"></span> Deploying...</>
            ) : (
              'Deploy New Parameters to Network'
            )}
          </button>
        </div>

        {/* Live Event Stream Panel */}
        <div className="bg-white dark:bg-[#080808] border border-zinc-200 dark:border-white/5 rounded-2xl p-8 shadow-sm dark:shadow-none flex flex-col h-[600px]">
          <div className="flex justify-between items-center mb-6 border-b border-zinc-100 dark:border-white/5 pb-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-1">Live Sentinel Incident Stream</h3>
              <p className="text-[11px] text-zinc-500 uppercase tracking-widest font-semibold flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  wsStatus === 'connected' ? 'bg-green-500 animate-pulse' :
                  wsStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'
                }`}></span>
                {wsStatus === 'connected' ? 'WSS Connected' :
                 wsStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
              </p>
            </div>
            <button
              onClick={() => setAlerts([])}
              className="text-[10px] text-zinc-400 hover:text-zinc-600 font-bold uppercase tracking-widest transition-colors"
            >
              Clear
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 hide-scrollbar pr-2">
            {alerts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[12px] text-zinc-400 font-medium space-y-3">
                <span className="material-symbols-outlined text-4xl opacity-50">wifi_tethering</span>
                <span>Awaiting active systemic events...</span>
                <span className="text-[10px] text-zinc-300 dark:text-zinc-600">Make transfers to generate real-time alerts</span>
              </div>
            ) : (
              alerts.map((alert, i) => (
                <div key={i} className="p-4 border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 rounded-xl flex justify-between items-center animate-in slide-in-from-top-2">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono text-red-600 dark:text-red-400 font-bold uppercase tracking-widest">
                       TxID: {alert.transfer_id || alert.transaction_id || 'unknown'}
                    </span>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">
                       Critical Risk Detected: <span className="text-red-500 font-bold">{((alert.risk_score || alert.score || 0.85)*100).toFixed(0)}%</span>
                    </p>
                    {alert.rules_triggered && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(Array.isArray(alert.rules_triggered) ? alert.rules_triggered : []).map((rule, j) => (
                          <span key={j} className="px-1.5 py-0.5 bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded text-[8px] font-bold uppercase">
                            {rule.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="material-symbols-outlined text-red-500 text-2xl shrink-0">gpp_maybe</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Credit Approvals Panel */}
      <div className="bg-white dark:bg-[#080808] border border-zinc-200 dark:border-white/5 rounded-2xl p-8 shadow-sm dark:shadow-none">
          <div className="border-b border-zinc-100 dark:border-white/5 pb-4 mb-6">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-1">Credit Approvals</h3>
            <p className="text-[11px] text-zinc-500 uppercase tracking-widest font-semibold">Review Pending Loan Disbursals</p>
          </div>
          
          <div className="space-y-4">
             {pendingLoans.length === 0 ? (
                <p className="text-[12px] text-zinc-400 font-medium">No pending loans requiring approval.</p>
             ) : (
                pendingLoans.map(loan => (
                   <div key={loan.id} className="flex flex-col md:flex-row justify-between items-center p-4 border border-zinc-200 dark:border-white/5 rounded-xl bg-zinc-50 dark:bg-black/20 gap-4">
                      <div>
                         <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">User ID: {loan.user_id}</span>
                         <h4 className="text-xl font-black text-slate-900 dark:text-white mt-1">₹{loan.principal_amount.toLocaleString()}</h4>
                         <p className="text-[11px] font-mono text-zinc-500 mt-1">{loan.interest_rate}% Fixed Interest</p>
                      </div>
                      <div className="flex gap-2 w-full md:w-auto">
                         <button onClick={() => handleApproveLoan(loan.id)} className="flex-1 px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-emerald-500 transition-colors">Approve</button>
                         <button onClick={() => handleRejectLoan(loan.id)} className="flex-1 px-6 py-2 bg-rose-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-rose-500 transition-colors">Reject</button>
                      </div>
                   </div>
                ))
             )}
          </div>
      </div>
    </div>
  );
}
