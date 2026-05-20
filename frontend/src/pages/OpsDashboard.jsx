import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../lib/axios';
import { toast } from 'sonner';
import { formatIST } from '../lib/format';
import { getToken } from '../lib/auth';

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
      let wsHost = window.location.host;
      let protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

      const apiURL = import.meta.env.VITE_API_URL || '';
      if (apiURL.startsWith('http://') || apiURL.startsWith('https://')) {
        try {
          const url = new URL(apiURL);
          wsHost = url.host;
          protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        } catch (e) {
          console.error('Failed to parse VITE_API_URL for WebSocket', e);
        }
      }

      ws = new WebSocket(`${protocol}//${wsHost}/ws/fraud-alerts?token=${getToken()}`);

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
        toast.success('All parameters deployed.');
      }

      await fetchRules();
    } catch (err) {
      toast.error('Failed to deploy parameters');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-8 fade-in duration-500 pb-20 px-4 md:px-0">
      <div>
        <h1 className="text-[32px] md:text-[40px] font-light tracking-tight text-[#0A2540] m-0">Operations Matrix</h1>
        <p className="text-[14px] text-[#425466] mt-2 max-w-lg leading-[1.6]">
          Dynamic runtime adjustments for fraud rules and live incident monitoring.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">

        {/* Rule Config Panel */}
        <div className="bg-white border border-[#e3e8ee] rounded-[16px] p-6 shadow-[0_2px_5px_rgba(0,0,0,0.02)] space-y-6">
          <div className="border-b border-[#e3e8ee] pb-4">
            <h3 className="text-[16px] font-medium text-[#0A2540] mb-1">Heuristic Parameters</h3>
            <p className="text-[12px] text-[#6B7C93]">Adjust threshold models</p>
          </div>

          {rulesLoading ? (
            <div className="space-y-6">
              {[1,2,3,4].map(i => (
                <div key={i} className="space-y-3">
                  <div className="h-4 bg-[#f6f9fc] animate-pulse rounded w-2/3"></div>
                  <div className="h-2 bg-[#f6f9fc] animate-pulse rounded"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              {rules.map((rule) => (
                <div key={rule.rule_name} className="space-y-2 p-4 bg-[#f6f9fc] rounded-[8px] border border-[#e3e8ee]">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleRuleChange(rule.rule_name, 'enabled', !rule.enabled)}
                        className={`w-9 h-5 rounded-full transition-all relative ${rule.enabled ? 'bg-[#635BFF]' : 'bg-[#e3e8ee]'}`}
                      >
                        <div className="w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all shadow-sm"
                          style={{ left: rule.enabled ? 'calc(100% - 17px)' : '3px' }}
                        ></div>
                      </button>
                      <label className="text-[13px] text-[#0A2540] font-medium capitalize">
                        {rule.rule_name.replace(/_/g, ' ')}
                      </label>
                    </div>
                    <span className={`text-[12px] font-mono font-semibold px-2 py-0.5 rounded ${
                      rule.enabled
                        ? 'text-[#635BFF] bg-white border border-[#e3e8ee]'
                        : 'text-[#6B7C93] bg-[#e3e8ee]'
                    }`}>
                      {rule.weight.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range" min="0" max="3" step="0.1"
                    value={rule.weight}
                    disabled={!rule.enabled}
                    onChange={(e) => handleRuleChange(rule.rule_name, 'weight', parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-[#e3e8ee] rounded-lg appearance-none cursor-pointer accent-[#635BFF] disabled:opacity-30 disabled:cursor-not-allowed"
                  />
                  {rule.threshold_value !== null && rule.threshold_value !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#6B7C93] font-medium">Threshold:</span>
                      <input
                        type="number"
                        value={rule.threshold_value}
                        disabled={!rule.enabled}
                        onChange={(e) => handleRuleChange(rule.rule_name, 'threshold_value', parseFloat(e.target.value))}
                        className="w-24 bg-white border border-[#e3e8ee] rounded-[6px] px-2 py-1 text-[12px] font-mono outline-none focus:border-[#635BFF] disabled:opacity-30 text-[#0A2540]"
                      />
                    </div>
                  )}
                  {rule.description && (
                    <p className="text-[11px] text-[#6B7C93]">{rule.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleSaveConfig}
            disabled={isSaving || rulesLoading}
            className="w-full py-3 bg-[#0A2540] hover:bg-[#112F4E] text-white font-medium rounded-[8px] text-[14px] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Deploying...</>
            ) : (
              'Deploy Parameters'
            )}
          </button>
        </div>

        {/* Live Event Stream Panel */}
        <div className="bg-white border border-[#e3e8ee] rounded-[16px] p-6 shadow-[0_2px_5px_rgba(0,0,0,0.02)] flex flex-col h-[600px]">
          <div className="flex justify-between items-center mb-4 border-b border-[#e3e8ee] pb-4">
            <div>
              <h3 className="text-[16px] font-medium text-[#0A2540] mb-1">Live Incident Stream</h3>
              <p className="text-[12px] text-[#6B7C93] flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  wsStatus === 'connected' ? 'bg-[#0CBF4C]' :
                  wsStatus === 'connecting' ? 'bg-[#ff6118] animate-pulse' : 'bg-[#df1b41]'
                }`}></span>
                {wsStatus === 'connected' ? 'WebSocket Connected' :
                 wsStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
              </p>
            </div>
            <button
              onClick={() => setAlerts([])}
              className="text-[12px] text-[#6B7C93] hover:text-[#0A2540] font-medium transition-colors"
            >
              Clear
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-hide">
            {alerts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[13px] text-[#6B7C93] space-y-3">
                <span className="material-symbols-outlined text-[40px] text-[#e3e8ee]">wifi_tethering</span>
                <span>Awaiting incidents...</span>
                <span className="text-[12px] text-[#6B7C93]/60">Make transfers to generate real-time alerts</span>
              </div>
            ) : (
              alerts.map((alert, i) => (
                <div key={i} className="p-4 border border-[#ffcdcd] bg-[#fff5f5] rounded-[8px] flex justify-between items-start animate-in slide-in-from-top-2 gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <span className="text-[11px] font-mono text-[#df1b41] font-semibold">
                       TxID: {alert.transfer_id || alert.transaction_id || 'unknown'}
                    </span>
                    <p className="text-[13px] font-medium text-[#0A2540]">
                       Risk: <span className="text-[#df1b41] font-semibold">{((alert.risk_score || alert.score || 0.85)*100).toFixed(0)}%</span>
                    </p>
                    {alert.rules_triggered && (
                      <div className="flex flex-col gap-2 mt-2">
                        <div className="flex flex-wrap gap-1">
                          {(Array.isArray(alert.rules_triggered) ? alert.rules_triggered : []).filter(r => typeof r === 'string').map((rule, j) => (
                            <span key={j} className="px-1.5 py-0.5 bg-[#df1b41]/10 text-[#df1b41] rounded text-[9px] font-bold uppercase">
                              {rule.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                        {(Array.isArray(alert.rules_triggered) ? alert.rules_triggered : []).filter(r => typeof r === 'object' && r?.xai_factor).map((xai, j) => (
                          <div key={j} className="w-full bg-[#0A2540] rounded-[6px] p-3 border-l-2 border-[#635BFF]">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7C93] mb-0.5 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px] text-[#635BFF]">psychology</span>
                              AI Insight
                            </p>
                            <p className="text-[13px] font-medium text-white mb-0.5">{xai.xai_factor}</p>
                            <p className="text-[11px] text-[#6B7C93]">{xai.xai_detail}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="material-symbols-outlined text-[#df1b41] text-[20px]">gpp_maybe</span>
                    {(alert.transfer_id || alert.transaction_id) && (
                      <a 
                        href={`/api/fraud/str/${alert.transfer_id || alert.transaction_id}`} 
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 bg-[#df1b41] hover:bg-[#c91839] text-white rounded text-[10px] font-semibold transition-colors flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[12px]">download</span>
                        STR
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Credit Approvals Panel */}
      <div className="bg-white border border-[#e3e8ee] rounded-[16px] p-6 shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
          <div className="border-b border-[#e3e8ee] pb-4 mb-6">
            <h3 className="text-[16px] font-medium text-[#0A2540] mb-1">Credit Approvals</h3>
            <p className="text-[12px] text-[#6B7C93]">Review Pending Loan Disbursals</p>
          </div>
          
          <div className="space-y-4">
             {pendingLoans.length === 0 ? (
                <p className="text-[13px] text-[#6B7C93]">No pending loans requiring approval.</p>
             ) : (
                pendingLoans.map(loan => (
                   <div key={loan.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 border border-[#e3e8ee] rounded-[8px] bg-[#f6f9fc] gap-4">
                      <div>
                         <span className="text-[11px] text-[#6B7C93] uppercase font-bold tracking-wider">User: {loan.user_id}</span>
                         <h4 className="text-[22px] font-light text-[#0A2540] mt-1">₹{loan.principal_amount.toLocaleString()}</h4>
                         <p className="text-[12px] font-mono text-[#6B7C93] mt-1">{loan.interest_rate}% Fixed Interest</p>
                      </div>
                      <div className="flex gap-2 w-full md:w-auto">
                         <button onClick={() => handleApproveLoan(loan.id)} className="flex-1 px-5 py-2 bg-[#0A2540] hover:bg-[#112F4E] text-white rounded-[6px] font-medium text-[13px] transition-colors">Approve</button>
                         <button onClick={() => handleRejectLoan(loan.id)} className="flex-1 px-5 py-2 bg-white border border-[#df1b41] text-[#df1b41] hover:bg-[#fff5f5] rounded-[6px] font-medium text-[13px] transition-colors">Reject</button>
                      </div>
                   </div>
                ))
             )}
          </div>
      </div>

      {/* System Settings Panel */}
      <SystemSettingsPanel />
    </div>
  );
}

function SystemSettingsPanel() {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    apiClient.get('/admin/settings')
      .then(res => setSettings(res.data))
      .catch(() => toast.error('Failed to load system settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleUpdate = async (key, newValue) => {
    setSaving(key);
    try {
      await apiClient.put('/admin/settings', { key, value: newValue });
      setSettings(prev => prev.map(s => s.key === key ? { ...s, value: newValue } : s));
      toast.success(`${key} updated`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Update failed');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="bg-white border border-[#e3e8ee] rounded-[16px] p-6 shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
      <div className="border-b border-[#e3e8ee] pb-4 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-[#635BFF] text-[18px]">tune</span>
          <h3 className="text-[16px] font-medium text-[#0A2540]">System Settings</h3>
        </div>
        <p className="text-[12px] text-[#6B7C93]">Admin-configurable runtime limits & thresholds</p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="h-16 bg-[#f6f9fc] animate-pulse rounded-[8px]" />
          ))}
        </div>
      ) : settings.length === 0 ? (
        <p className="text-[13px] text-[#6B7C93]">No settings configured yet.</p>
      ) : (
        <div className="space-y-3">
          {settings.map(s => (
            <div key={s.key} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border border-[#e3e8ee] rounded-[8px] bg-[#f6f9fc]">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[#0A2540] capitalize">{s.key.replace(/_/g, ' ')}</p>
                <p className="text-[11px] text-[#6B7C93] mt-0.5 truncate">{s.description || 'No description'}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="text"
                  defaultValue={s.value}
                  onBlur={e => {
                    if (e.target.value !== s.value) {
                      handleUpdate(s.key, e.target.value);
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.target.blur();
                    }
                  }}
                  className="w-28 bg-white border border-[#e3e8ee] rounded-[6px] px-3 py-2 text-[13px] font-mono font-medium text-right outline-none focus:border-[#635BFF] transition-all text-[#0A2540]"
                />
                {saving === s.key && (
                  <span className="w-4 h-4 border-2 border-[#635BFF]/30 border-t-[#635BFF] rounded-full animate-spin shrink-0"></span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
