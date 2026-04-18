import React, { useEffect, useState, useContext } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import apiClient from '../lib/axios';
import { ThemeContext } from '../App';
import { useMinLoadingTime } from '../lib/useMinLoadingTime';

export function FraudAnalytics() {
  const { isDark } = useContext(ThemeContext);
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chartHistory, setChartHistory] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [metricsData, setMetricsData] = useState(null);

  // Initial load + polling
  useEffect(() => {
    let isMounted = true;

    const fetchAll = async () => {
      try {
        const [dashRes, timelineRes, metricsRes] = await Promise.allSettled([
          apiClient.get('/fraud/dashboard'),
          apiClient.get('/fraud/metrics/timeline?limit=60'),
          apiClient.get('/fraud/metrics'),
        ]);

        if (!isMounted) return;

        if (dashRes.status === 'fulfilled') {
          setDashboardData(dashRes.value.data);
        }

        if (timelineRes.status === 'fulfilled') {
          setChartHistory(timelineRes.value.data);
        }

        if (metricsRes.status === 'fulfilled') {
          setMetricsData(metricsRes.value.data);
        }

        setIsLoading(false);
      } catch (err) {
        if (isMounted) {
          console.error('Failed to fetch fraud analytics', err);
          setIsLoading(false);
        }
      }
    };

    fetchAll();
    const interval = setInterval(fetchAll, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const showSkeleton = useMinLoadingTime(isLoading, 1200);

  const handleExportTrace = async () => {
    if (!dashboardData) return;
    setIsExporting(true);

    try {
      const rows = [
        ['Rule', 'Trigger Count'],
        ...((dashboardData.top_rules_triggered || []).map(r => [r.rule, r.count])),
        [],
        ['Risk Level', 'Count'],
        ['Low', dashboardData.risk_distribution?.low || 0],
        ['Medium', dashboardData.risk_distribution?.medium || 0],
        ['High', dashboardData.risk_distribution?.high || 0],
        ['Critical', dashboardData.risk_distribution?.critical || 0],
      ];

      const csv = rows.map(r => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sentinel_trace_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const flaggedCount = dashboardData?.flagged || 0;
  const confidenceVector = dashboardData
    ? ((1 - (dashboardData.flagged_rate || 0)) * 100).toFixed(1)
    : '0';
  const avgMlScore = metricsData?.avg_ml_score != null
    ? (metricsData.avg_ml_score * 100).toFixed(2)
    : null;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">Fraud Intelligence</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-lg">
          Real-time monitoring of rule-based heuristic detection, active threat mitigation, and risk distribution.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Critical Threats Blocked */}
        <div className="bg-white dark:bg-[#080808] border border-zinc-200 dark:border-white/5 rounded-2xl p-6 shadow-sm dark:shadow-none flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-4">
            <span className={`w-2 h-2 rounded-full ${flaggedCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-red-500/50'} shadow-[0_0_8px_rgba(239,68,68,0.6)]`}></span>
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 dark:text-zinc-500 font-bold">Critical Threats Blocked</span>
          </div>
          <div className="text-5xl font-mono font-bold text-zinc-900 dark:text-white tracking-tighter">
            {showSkeleton ? <span className="h-12 w-16 bg-zinc-100 dark:bg-white/5 animate-pulse rounded block"></span> : flaggedCount}
          </div>
          {dashboardData && flaggedCount > 0 && (
            <p className="text-[10px] text-red-500 font-bold mt-3 uppercase tracking-widest">
              {((dashboardData.flagged_rate || 0) * 100).toFixed(1)}% of total volume
            </p>
          )}
        </div>

        {/* AI Confidence Vector */}
        <div className="bg-white dark:bg-[#080808] border border-zinc-200 dark:border-white/5 rounded-2xl p-6 shadow-sm dark:shadow-none flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(79,70,229,0.5)]"></span>
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 dark:text-zinc-500 font-bold">Security Confidence</span>
          </div>
          <div className="text-5xl font-mono font-bold text-zinc-900 dark:text-white tracking-tighter">
            {showSkeleton ? <span className="h-12 w-20 bg-zinc-100 dark:bg-white/5 animate-pulse rounded block"></span> : `${confidenceVector}%`}
          </div>
          {dashboardData && (
            <p className="text-[10px] text-zinc-400 font-bold mt-3 uppercase tracking-widest">
              {dashboardData.total_transfers} transactions analyzed
            </p>
          )}
        </div>


        {/* Export + Risk Distribution */}
        <div className="bg-white dark:bg-[#080808] border border-zinc-200 dark:border-white/5 rounded-2xl p-6 shadow-sm dark:shadow-none flex flex-col justify-between bg-[radial-gradient(ellipse_at_bottom,rgba(79,70,229,0.05)_0%,transparent_70%)]">
           {dashboardData?.risk_distribution && (
             <div className="space-y-2 mb-4">
               <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-black">Risk Distribution</span>
               <div className="grid grid-cols-2 gap-2">
                 {Object.entries(dashboardData.risk_distribution).map(([level, count]) => (
                   <div key={level} className="flex items-center gap-2">
                     <span className={`w-2 h-2 rounded-full ${
                       level === 'critical' ? 'bg-red-500' :
                       level === 'high' ? 'bg-amber-500' :
                       level === 'medium' ? 'bg-indigo-500' : 'bg-emerald-500'
                     }`}></span>
                     <span className="text-[10px] font-bold text-zinc-500 uppercase">{level}: {count}</span>
                   </div>
                 ))}
               </div>
             </div>
           )}
           <button
             onClick={handleExportTrace}
             disabled={isExporting || !dashboardData}
             className="w-full py-4 bg-zinc-50 hover:bg-zinc-100 dark:bg-[#121315] dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-bold rounded-xl text-[11px] uppercase tracking-widest transition-colors border border-zinc-200/50 dark:border-white/5 shadow-sm dark:shadow-none disabled:opacity-50 flex items-center justify-center gap-2"
           >
              <span className="material-symbols-outlined text-[18px]">dataset</span>
              {isExporting ? 'Exporting...' : 'Export Trace Log'}
           </button>
        </div>
      </div>

      {/* Top Rules Triggered */}
      {dashboardData?.top_rules_triggered?.length > 0 && (
        <div className="bg-white dark:bg-[#080808] border border-zinc-200 dark:border-white/5 rounded-2xl p-6 shadow-sm dark:shadow-none">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-4">Top Triggered Rules</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {dashboardData.top_rules_triggered.map((item, i) => (
              <div key={i} className="p-3 bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/10 rounded-xl text-center">
                <span className="text-lg font-mono font-black text-red-500">{item.count}</span>
                <p className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold mt-1">{item.rule?.replace(/_/g, ' ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Threat Perception Chart */}
      <div className="bg-white dark:bg-[#080808] border border-zinc-200 dark:border-white/5 rounded-2xl p-6 shadow-sm dark:shadow-none">
        <div className="flex items-center justify-between mb-8 border-b border-zinc-100 dark:border-white/5 pb-4">
           <div>
             <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Threat Perception Level (Live Window)</h3>
             <p className="text-[10px] text-zinc-400 mt-1 flex items-center gap-3">
               <span className="flex items-center gap-1.5">
                 <span className="w-3 h-0.5 bg-red-500 rounded-full inline-block"></span>
                 Risk Score
               </span>
             </p>
           </div>
           <span className="text-[9px] font-bold text-zinc-500 font-mono uppercase tracking-widest bg-zinc-100 dark:bg-[#121315] px-2.5 py-1 rounded">Polling 5s</span>
        </div>

        <div className="min-h-[400px] h-[400px] w-full mt-4 relative">
          {chartHistory.length === 0 ? (
            <div className="h-full flex items-center justify-center border-2 border-dashed border-zinc-100 dark:border-white/5 rounded-2xl">
              <div className="text-center space-y-2">
                <span className="material-symbols-outlined text-4xl text-zinc-300 dark:text-zinc-700">monitoring</span>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Collecting data points...</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={1}>
              <AreaChart data={chartHistory} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorMlScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke={isDark ? "#52525b" : "#71717a"} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={isDark ? "#52525b" : "#71717a"} fontSize={11} tickLine={false} axisLine={false} domain={[0, 1]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? 'rgba(0,0,0,0.95)' : '#fff',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    padding: '12px 16px',
                  }}
                  itemStyle={{fontSize: '12px', fontWeight: 'bold'}}
                  labelStyle={{color: '#a1a1aa', fontSize: '10px', marginBottom: '6px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em'}}
                  formatter={(val, name) => {
                    const label = name === 'risk' ? 'Composite Risk' : name === 'ml_risk' ? 'ML P(Fraud)' : name;
                    const color = name === 'risk' ? '#ef4444' : '#8b5cf6';
                    return [typeof val === 'number' ? val.toFixed(4) : val, label];
                  }}
                />
                <Area
                  type="step"
                  dataKey="risk"
                  stroke="#ef4444"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorScore)"
                  isAnimationActive={false}
                  name="risk"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
