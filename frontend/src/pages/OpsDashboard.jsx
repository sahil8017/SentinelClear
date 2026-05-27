import React, { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../lib/axios';
import { toast } from 'sonner';
import { formatIST } from '../lib/format';
import { getToken } from '../lib/auth';

// ── Contextual impact text per rule ──────────────────────────────────────────
const RULE_IMPACT_TEXT = {
  amount_threshold: 'Adjusts sensitivity to uncharacteristically large transfers. Lowering catches anomalies early; raising reduces false alarms for high-net-worth users.',
  burst_velocity: 'Flags rapid, machine-like transfer bursts. Essential for stopping automated script attacks and velocity fraud.',
  new_account: 'Applies an extra risk penalty multiplier to newly registered identities to restrict early-life transfer limits.',
  time_of_day: 'Multiplies risk scores for transactions executed during high-risk sleeping hours (1 AM - 5 AM).',
  velocity: 'Monitors abnormal account activity spikes over a tight time window compared to the historical user baseline.',
};
const RULE_IMPACT_DEFAULT = 'Adjusting this weight changes how much this rule contributes to the overall composite risk score.';

// ── Hardcoded baseline defaults ───────────────────────────────────────────────
const RULE_DEFAULTS = {
  amount_threshold: { weight: 1.0, enabled: true, threshold_value: 50000 },
  velocity:         { weight: 1.5, enabled: true, threshold_value: null },
  burst_velocity:   { weight: 2.0, enabled: true, threshold_value: 10 },
  new_account:      { weight: 1.3, enabled: true, threshold_value: 10000 },
  time_of_day:      { weight: 0.8, enabled: true, threshold_value: null },
};

const getThresholdUnit = (ruleName) => {
  if (ruleName.includes('amount') || ruleName.includes('volume') || ruleName.includes('new_account')) return '₹';
  if (ruleName.includes('velocity')) return 'txns';
  return '';
};

const getSettingPrefix = (key) => {
  if (key === 'FRAUD_BLOCK_THRESHOLD' || key === 'FRAUD_REVIEW_THRESHOLD') return '';
  if (key === 'DAILY_VELOCITY_LIMIT' || key === 'VULNERABLE_AGE_THRESHOLD') return '';
  const k = key.toLowerCase();
  if (k.includes('limit') || k.includes('threshold')) return '₹';
  return '';
};

const getSettingSuffix = (key) => {
  if (key === 'DAILY_VELOCITY_LIMIT') return 'txns';
  if (key === 'VULNERABLE_AGE_THRESHOLD') return 'Years';
  return '';
};

// ── JWT username helper ───────────────────────────────────────────────────────
const getUsernameFromJWT = () => {
  try {
    const token = getToken();
    if (!token) return 'Admin';
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub || payload.username || 'Admin';
  } catch { return 'Admin'; }
};

// ── Append to localStorage changelog ─────────────────────────────────────────
const writeChangeLog = (ruleName, field, oldValue, newValue) => {
  try {
    const logs = JSON.parse(localStorage.getItem('sc_admin_changelog') || '[]');
    logs.unshift({
      id: Date.now(),
      timestamp: new Date().toISOString(),
      admin: getUsernameFromJWT(),
      rule: ruleName,
      field,
      old_value: String(oldValue ?? '—'),
      new_value: String(newValue ?? '—'),
    });
    localStorage.setItem('sc_admin_changelog', JSON.stringify(logs.slice(0, 500)));
  } catch {}
};

export function OpsDashboard() {
  const [rules, setRules] = useState([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [wsStatus, setWsStatus] = useState('connecting');
  const [pendingLoans, setPendingLoans] = useState([]);
  const [sysSettings, setSysSettings] = useState([]);
  const [sysSettingsLoading, setSysSettingsLoading] = useState(true);
  const [sysSaving, setSysSaving] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Capture the server-side originals for change-log diffing
  const serverRulesRef = useRef([]);

  const fetchPendingLoans = useCallback(async () => {
    try {
      const res = await apiClient.get('/loans/admin/all');
      setPendingLoans(res.data.filter(l => l.status === 'PENDING'));
    } catch {}
  }, []);

  const handleApproveLoan = async (loanId) => {
    try {
      await apiClient.post(`/loans/admin/${loanId}/approve`);
      toast.success('Loan Disbursed');
      fetchPendingLoans();
    } catch { toast.error('Failed to approve loan'); }
  };

  const handleRejectLoan = async (loanId) => {
    try {
      await apiClient.post(`/loans/admin/${loanId}/reject`);
      toast.success('Loan Rejected');
      fetchPendingLoans();
    } catch { toast.error('Failed to reject loan'); }
  };

  const fetchRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const res = await apiClient.get('/fraud/rules');
      // Filter out impossible_travel — not meaningful in this context
      const filtered = res.data.filter(r => r.rule_name !== 'impossible_travel');
      setRules(filtered);
      serverRulesRef.current = filtered.map(r => ({ ...r }));
    } catch {
      toast.error('Failed to load heuristic parameters');
    } finally {
      setRulesLoading(false);
    }
  }, []);

  const fetchSysSettings = useCallback(async () => {
    setSysSettingsLoading(true);
    try {
      const res = await apiClient.get('/admin/settings');
      setSysSettings(res.data);
    } catch {} finally {
      setSysSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
    fetchPendingLoans();
    fetchSysSettings();
  }, [fetchRules, fetchPendingLoans, fetchSysSettings]);

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
        } catch {}
      }
      ws = new WebSocket(`${protocol}//${wsHost}/ws/fraud-alerts?token=${getToken()}`);
      ws.onopen = () => setWsStatus('connected');
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setAlerts(prev => [{ ...data, timestamp: formatIST(new Date()) }, ...prev].slice(0, 15));
        } catch {}
      };
      ws.onclose = () => { setWsStatus('disconnected'); reconnectTimeout = setTimeout(connect, 5000); };
      ws.onerror = () => setWsStatus('error');
    };
    connect();
    return () => { if (ws) ws.close(); if (reconnectTimeout) clearTimeout(reconnectTimeout); };
  }, []);

  const handleRuleChange = (ruleName, field, value) => {
    setRules(prev => prev.map(r => r.rule_name === ruleName ? { ...r, [field]: value } : r));
  };

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

      // Write change log entries for each changed field
      rules.forEach((rule, idx) => {
        if (results[idx].status === 'fulfilled') {
          const original = serverRulesRef.current.find(r => r.rule_name === rule.rule_name);
          if (!original) return;
          if (original.weight !== rule.weight)
            writeChangeLog(rule.rule_name, 'weight', original.weight.toFixed(1) + 'x', rule.weight.toFixed(1) + 'x');
          if (original.enabled !== rule.enabled)
            writeChangeLog(rule.rule_name, 'enabled', original.enabled, rule.enabled);
          if (original.threshold_value !== rule.threshold_value && rule.threshold_value != null)
            writeChangeLog(rule.rule_name, 'threshold', original.threshold_value, rule.threshold_value);
        }
      });

      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        toast.warning(`${rules.length - failed.length}/${rules.length} rules deployed. ${failed.length} failed.`);
      } else {
        toast.success('All parameters deployed. Change log updated.');
      }
      await fetchRules();
    } catch {
      toast.error('Failed to deploy parameters');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setRules(prev => prev.map(r => {
      const def = RULE_DEFAULTS[r.rule_name];
      if (!def) return r;
      return { ...r, weight: def.weight, enabled: def.enabled, threshold_value: def.threshold_value ?? r.threshold_value };
    }));
    setShowResetConfirm(false);
    toast.info('Parameters reset to global defaults — click Deploy to apply.');
  };

  const handleUpdateSysSetting = async (key, newValue) => {
    setSysSaving(key);
    const oldSetting = sysSettings.find(s => s.key === key);
    try {
      await apiClient.put('/admin/settings', { key, value: newValue });
      setSysSettings(prev => prev.map(s => s.key === key ? { ...s, value: newValue } : s));
      writeChangeLog(key, 'value', oldSetting?.value ?? '—', newValue);
      toast.success(`${key.replace(/_/g, ' ')} updated`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Update failed');
    } finally {
      setSysSaving(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-8 fade-in duration-500 pb-20 px-4 md:px-0">
      <div>
        <h1 className="text-[32px] md:text-[40px] font-light tracking-tight text-[#0A2540] m-0">Operations Matrix</h1>
        <p className="text-[14px] text-[#425466] mt-2 max-w-lg leading-[1.6]">
          Unified runtime control for all fraud parameters and live incident monitoring.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">

        {/* ── Unified System Configuration ─────────────────────────────── */}
        <div className="bg-white border border-[#e3e8ee] rounded-[16px] p-6 shadow-[0_2px_5px_rgba(0,0,0,0.02)] flex flex-col h-[650px]">
          {/* Panel Header */}
          <div className="border-b border-[#e3e8ee] pb-4 mb-4 shrink-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#635BFF] text-[20px]">tune</span>
                <h3 className="text-[16px] font-medium text-[#0A2540]">System Configuration</h3>
              </div>
              <button
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#f6f9fc] hover:bg-[#fff5f2] border border-[#e3e8ee] hover:border-[#ffcdcd] text-[#6B7C93] hover:text-[#df1b41] rounded-[6px] text-[12px] font-medium transition-all min-h-[36px]"
                title="Reset all parameters to global defaults"
              >
                <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                <span className="hidden sm:inline">Reset Defaults</span>
              </button>
            </div>
            <p className="text-[12px] text-[#6B7C93]">Fraud rules and system limits — all in one place.</p>
          </div>

          {/* Reset Confirmation Banner */}
          {showResetConfirm && (
            <div className="mb-4 p-3 bg-[#fff5f2] border border-[#ffe0d4] rounded-[8px] flex flex-col sm:flex-row sm:items-center gap-3 shrink-0 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 flex-1">
                <span className="material-symbols-outlined text-[#ff6118] text-[18px]">warning</span>
                <p className="text-[13px] text-[#ff6118] font-medium">Reset all parameters to global defaults?</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={handleResetDefaults} className="px-3 py-1.5 bg-[#ff6118] text-white text-[12px] font-medium rounded transition-colors hover:bg-[#e55b14] min-h-[36px]">
                  Reset
                </button>
                <button onClick={() => setShowResetConfirm(false)} className="px-3 py-1.5 bg-white border border-[#e3e8ee] text-[#6B7C93] text-[12px] font-medium rounded hover:bg-[#f6f9fc] min-h-[36px]">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Scrollable Rule List */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-3">
            {rulesLoading ? (
              <div className="space-y-4 pt-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="p-4 bg-[#f6f9fc] rounded-[8px] border border-[#e3e8ee] space-y-3 animate-pulse">
                    <div className="h-4 bg-[#e3e8ee] rounded w-2/3" />
                    <div className="h-2 bg-[#e3e8ee] rounded w-full" />
                    <div className="h-3 bg-[#e3e8ee] rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Fraud Rules */}
                <p className="text-[10px] font-bold text-[#6B7C93] uppercase tracking-widest px-1 pt-1">Fraud Detection Rules</p>
                {rules.map((rule) => (
                  <div key={rule.rule_name} className="p-4 bg-[#f6f9fc] rounded-[8px] border border-[#e3e8ee] space-y-3">
                    {/* Rule Header */}
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        {/* Toggle — 44px touch target */}
                        <button
                          onClick={() => handleRuleChange(rule.rule_name, 'enabled', !rule.enabled)}
                          className={`w-10 h-6 rounded-full transition-all relative shrink-0 min-w-[40px] min-h-[44px] flex items-center ${rule.enabled ? 'bg-[#635BFF]' : 'bg-[#e3e8ee]'}`}
                          aria-label={rule.enabled ? 'Disable rule' : 'Enable rule'}
                        >
                          <div className="w-4 h-4 bg-white rounded-full absolute shadow-sm transition-all"
                            style={{ left: rule.enabled ? 'calc(100% - 18px)' : '3px' }}
                          />
                        </button>
                        <label className="text-[13px] text-[#0A2540] font-semibold capitalize cursor-pointer" onClick={() => handleRuleChange(rule.rule_name, 'enabled', !rule.enabled)}>
                          {rule.rule_name.replace(/_/g, ' ')}
                        </label>
                      </div>
                      <span className={`text-[12px] font-mono font-bold px-2 py-0.5 rounded min-w-[44px] text-center ${
                        rule.enabled ? 'text-[#635BFF] bg-white border border-[#e3e8ee]' : 'text-[#6B7C93] bg-[#e3e8ee]'
                      }`}>
                        {rule.weight.toFixed(1)}×
                      </span>
                    </div>

                    {/* Adjust Threshold Slider */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-medium text-[#6B7C93]">Adjust Threshold</span>
                        <span className="text-[11px] font-mono text-[#6B7C93]">0× — 3×</span>
                      </div>
                      <input
                        type="range" min="0" max="3" step="0.1"
                        value={rule.weight}
                        disabled={!rule.enabled}
                        onChange={(e) => handleRuleChange(rule.rule_name, 'weight', parseFloat(e.target.value))}
                        className="w-full h-2 bg-[#e3e8ee] rounded-lg appearance-none cursor-pointer accent-[#635BFF] disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px]"
                        style={{ height: '6px', marginTop: '4px', marginBottom: '4px' }}
                      />
                      {/* Impact projection text */}
                      <p className="text-[11px] text-[#6B7C93] italic leading-[1.5]">
                        {RULE_IMPACT_TEXT[rule.rule_name] || RULE_IMPACT_DEFAULT}
                      </p>
                    </div>

                    {/* Numeric threshold */}
                    {rule.threshold_value !== null && rule.threshold_value !== undefined && (
                      <div className="flex items-center gap-2.5">
                        <span className="text-[11px] text-[#6B7C93] font-medium shrink-0">Threshold:</span>
                        <div className="relative flex items-center">
                          {getThresholdUnit(rule.rule_name) === '₹' && (
                            <span className="absolute left-2.5 text-[11px] text-[#6B7C93] font-mono">₹</span>
                          )}
                          <input
                            type="number"
                            value={rule.threshold_value}
                            disabled={!rule.enabled}
                            onChange={(e) => handleRuleChange(rule.rule_name, 'threshold_value', parseFloat(e.target.value))}
                            className={`w-28 bg-white border border-[#e3e8ee] rounded-[6px] py-1.5 text-[12px] font-mono outline-none focus:border-[#635BFF] disabled:opacity-30 text-[#0A2540] min-h-[36px] ${
                              getThresholdUnit(rule.rule_name) === '₹' ? 'pl-5 pr-2' : 'px-2'
                            }`}
                          />
                          {getThresholdUnit(rule.rule_name) && getThresholdUnit(rule.rule_name) !== '₹' && (
                            <span className="ml-1.5 text-[11px] text-[#6B7C93] font-medium">{getThresholdUnit(rule.rule_name)}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* System Settings */}
                {!sysSettingsLoading && sysSettings.length > 0 && (
                  <>
                    <p className="text-[10px] font-bold text-[#6B7C93] uppercase tracking-widest px-1 pt-3">Banking Limits</p>
                    {sysSettings.map(s => (
                      <div key={s.key} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border border-[#e3e8ee] rounded-[8px] bg-[#f6f9fc]">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-[#0A2540] capitalize">{s.key.replace(/_/g, ' ')}</p>
                          <p className="text-[11px] text-[#6B7C93] mt-0.5">{s.description || 'System parameter'}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="relative flex items-center">
                            {getSettingPrefix(s.key) === '₹' && (
                              <span className="absolute left-2.5 text-[12px] text-[#6B7C93] font-mono top-1/2 -translate-y-1/2">₹</span>
                            )}
                            <input
                              type="text"
                              defaultValue={s.value}
                              onBlur={e => { if (e.target.value !== s.value) handleUpdateSysSetting(s.key, e.target.value); }}
                              onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                              className={`w-28 bg-white border border-[#e3e8ee] rounded-[6px] py-2 text-[13px] font-mono font-medium text-right outline-none focus:border-[#635BFF] transition-all text-[#0A2540] min-h-[44px] ${
                                getSettingPrefix(s.key) === '₹' ? 'pl-6 pr-3' : 'px-3'
                              }`}
                            />
                            {getSettingSuffix(s.key) && (
                              <span className="ml-1.5 text-[11px] text-[#6B7C93] font-medium shrink-0">{getSettingSuffix(s.key)}</span>
                            )}
                          </div>
                          {sysSaving === s.key && (
                            <span className="w-4 h-4 border-2 border-[#635BFF]/30 border-t-[#635BFF] rounded-full animate-spin shrink-0" />
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>

          {/* Deploy Button */}
          <div className="pt-4 border-t border-[#e3e8ee] mt-auto shrink-0">
            <button
              onClick={handleSaveConfig}
              disabled={isSaving || rulesLoading}
              className="w-full py-3.5 bg-[#0A2540] hover:bg-[#112F4E] text-white font-medium rounded-[8px] text-[14px] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 min-h-[44px]"
            >
              {isSaving ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Deploying...</>
              ) : (
                <><span className="material-symbols-outlined text-[18px]">rocket_launch</span> Deploy All Parameters</>
              )}
            </button>
          </div>
        </div>

        {/* ── Live Incident Stream ──────────────────────────────────────── */}
        <div className="bg-white border border-[#e3e8ee] rounded-[16px] p-6 shadow-[0_2px_5px_rgba(0,0,0,0.02)] flex flex-col h-[650px]">
          <div className="flex justify-between items-center mb-4 border-b border-[#e3e8ee] pb-4 shrink-0">
            <div>
              <h3 className="text-[16px] font-medium text-[#0A2540] mb-1">Live Incident Stream</h3>
              <p className="text-[12px] text-[#6B7C93] flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  wsStatus === 'connected' ? 'bg-[#0CBF4C]' :
                  wsStatus === 'connecting' ? 'bg-[#ff6118] animate-pulse' : 'bg-[#df1b41]'
                }`} />
                {wsStatus === 'connected' ? 'WebSocket Connected' :
                 wsStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
              </p>
            </div>
            {alerts.length > 0 && (
              <button
                onClick={() => setAlerts([])}
                className="text-[12px] text-[#6B7C93] hover:text-[#0A2540] font-medium transition-colors px-2 py-1 hover:bg-[#f6f9fc] rounded min-h-[36px]"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-hide">
            {alerts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-3 px-6">
                <div className="w-14 h-14 bg-[#e7f9ed] border border-[#0CBF4C]/20 rounded-[12px] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#0CBF4C] text-[28px]">verified_user</span>
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[#0A2540]">All systems clear</p>
                  <p className="text-[12px] text-[#6B7C93] mt-1">No flagged incidents — no action required.</p>
                  <p className="text-[11px] text-[#6B7C93]/60 mt-1">Make transfers to generate real-time alerts</p>
                </div>
              </div>
            ) : (
              alerts.map((alert, i) => (
                <div key={i} className="p-4 border border-[#ffcdcd] bg-[#fff5f5] rounded-[8px] flex justify-between items-start animate-in slide-in-from-top-2 gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <span className="text-[11px] font-mono text-[#df1b41] font-semibold">
                      TxID: {alert.transfer_id || alert.transaction_id || 'unknown'}
                    </span>
                    <p className="text-[13px] font-medium text-[#0A2540]">
                      Risk: <span className="text-[#df1b41] font-semibold">{((alert.risk_score || 0.85) * 100).toFixed(0)}%</span>
                    </p>
                    {alert.rules_triggered && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(Array.isArray(alert.rules_triggered) ? alert.rules_triggered : [])
                          .filter(r => typeof r === 'string')
                          .map((rule, j) => (
                          <span key={j} className="px-1.5 py-0.5 bg-[#df1b41]/10 text-[#df1b41] rounded text-[9px] font-bold uppercase">
                            {rule.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] text-[#6B7C93] font-mono">{alert.timestamp}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="material-symbols-outlined text-[#df1b41] text-[20px]">gpp_maybe</span>
                    {(alert.transfer_id || alert.transaction_id) && (
                      <a
                        href={`/api/fraud/str/${alert.transfer_id || alert.transaction_id}`}
                        target="_blank" rel="noreferrer"
                        className="px-2 py-1 bg-[#df1b41] hover:bg-[#c91839] text-white rounded text-[10px] font-semibold transition-colors flex items-center gap-1 min-h-[36px]"
                      >
                        <span className="material-symbols-outlined text-[12px]">download</span> STR
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Credit Approvals ──────────────────────────────────────────────── */}
      <div className="bg-white border border-[#e3e8ee] rounded-[16px] p-6 shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
        <div className="border-b border-[#e3e8ee] pb-4 mb-6">
          <h3 className="text-[16px] font-medium text-[#0A2540] mb-1">Credit Approvals</h3>
          <p className="text-[12px] text-[#6B7C93]">Review Pending Loan Disbursals</p>
        </div>

        {pendingLoans.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-12 h-12 bg-[#e7f9ed] border border-[#0CBF4C]/20 rounded-[10px] flex items-center justify-center">
              <span className="material-symbols-outlined text-[#0CBF4C] text-[24px]">task_alt</span>
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#0A2540]">All systems clear — no approvals required</p>
              <p className="text-[12px] text-[#6B7C93] mt-1">Pending loan applications will appear here for review.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingLoans.map(loan => (
              <div key={loan.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 border border-[#e3e8ee] rounded-[8px] bg-[#f6f9fc] gap-4">
                <div>
                  <span className="text-[11px] text-[#6B7C93] uppercase font-bold tracking-wider">User: {loan.user_id}</span>
                  <h4 className="text-[22px] font-light text-[#0A2540] mt-1">₹{loan.principal_amount.toLocaleString()}</h4>
                  <p className="text-[12px] font-mono text-[#6B7C93] mt-1">{loan.interest_rate}% Fixed Interest</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <button onClick={() => handleApproveLoan(loan.id)} className="flex-1 px-5 py-2.5 bg-[#0A2540] hover:bg-[#112F4E] text-white rounded-[6px] font-medium text-[13px] transition-colors min-h-[44px]">Approve</button>
                  <button onClick={() => handleRejectLoan(loan.id)} className="flex-1 px-5 py-2.5 bg-white border border-[#df1b41] text-[#df1b41] hover:bg-[#fff5f5] rounded-[6px] font-medium text-[13px] transition-colors min-h-[44px]">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
