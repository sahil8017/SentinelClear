import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import apiClient from '../lib/axios';
import { useMinLoadingTime } from '../lib/useMinLoadingTime';

export function FraudAnalytics() {
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chartHistory, setChartHistory] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [metricsData, setMetricsData] = useState(null);

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

  return (
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-8 fade-in duration-500 pb-20 px-4 md:px-0">
      <div>
        <h1 className="text-[32px] md:text-[40px] font-light tracking-tight text-[#0A2540] m-0">Fraud Intelligence</h1>
        <p className="text-[14px] text-[#425466] mt-2 max-w-lg leading-[1.6]">
          Real-time monitoring of rule-based heuristic detection, active threat mitigation, and risk distribution.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        {/* Critical Threats Blocked */}
        <div className="bg-white border border-[#e3e8ee] rounded-[12px] p-6 shadow-[0_2px_5px_rgba(0,0,0,0.02)] flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-3">
            <span className={`w-2 h-2 rounded-full ${flaggedCount > 0 ? 'bg-[#df1b41] animate-pulse' : 'bg-[#df1b41]/40'}`}></span>
            <span className="text-[11px] uppercase tracking-wider text-[#6B7C93] font-bold">Threats Blocked</span>
          </div>
          <div className="text-[40px] font-light text-[#0A2540] tracking-tight">
            {showSkeleton ? <span className="h-12 w-16 bg-[#f6f9fc] animate-pulse rounded block"></span> : flaggedCount}
          </div>
          {dashboardData && flaggedCount > 0 && (
            <p className="text-[12px] text-[#df1b41] font-medium mt-2">
              {((dashboardData.flagged_rate || 0) * 100).toFixed(1)}% of total volume
            </p>
          )}
        </div>

        {/* Security Confidence */}
        <div className="bg-white border border-[#e3e8ee] rounded-[12px] p-6 shadow-[0_2px_5px_rgba(0,0,0,0.02)] flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-[#635BFF]"></span>
            <span className="text-[11px] uppercase tracking-wider text-[#6B7C93] font-bold">Security Confidence</span>
          </div>
          <div className="text-[40px] font-light text-[#0A2540] tracking-tight">
            {showSkeleton ? <span className="h-12 w-20 bg-[#f6f9fc] animate-pulse rounded block"></span> : `${confidenceVector}%`}
          </div>
          {dashboardData && (
            <p className="text-[12px] text-[#6B7C93] font-medium mt-2">
              {dashboardData.total_transfers} transactions analyzed
            </p>
          )}
        </div>

        {/* Export + Risk Distribution */}
        <div className="bg-white border border-[#e3e8ee] rounded-[12px] p-6 shadow-[0_2px_5px_rgba(0,0,0,0.02)] flex flex-col justify-between sm:col-span-2 md:col-span-1">
           {dashboardData?.risk_distribution && (
             <div className="space-y-2 mb-4">
               <span className="text-[11px] uppercase tracking-wider text-[#6B7C93] font-bold">Risk Distribution</span>
               <div className="grid grid-cols-2 gap-2">
                 {Object.entries(dashboardData.risk_distribution).map(([level, count]) => (
                   <div key={level} className="flex items-center gap-2">
                     <span className={`w-2 h-2 rounded-full ${
                       level === 'critical' ? 'bg-[#df1b41]' :
                       level === 'high' ? 'bg-[#ff6118]' :
                       level === 'medium' ? 'bg-[#635BFF]' : 'bg-[#0CBF4C]'
                     }`}></span>
                     <span className="text-[12px] font-medium text-[#425466] capitalize">{level}: {count}</span>
                   </div>
                 ))}
               </div>
             </div>
           )}
           <button
             onClick={handleExportTrace}
             disabled={isExporting || !dashboardData}
             className="w-full py-2.5 bg-white hover:bg-[#f6f9fc] text-[#0A2540] font-medium rounded-[8px] text-[13px] transition-colors border border-[#e3e8ee] disabled:opacity-50 flex items-center justify-center gap-2"
           >
              <span className="material-symbols-outlined text-[16px]">dataset</span>
              {isExporting ? 'Exporting...' : 'Export Trace Log'}
           </button>
        </div>
      </div>

      {/* Top Rules Triggered */}
      {dashboardData?.top_rules_triggered?.length > 0 && (
        <div className="bg-white border border-[#e3e8ee] rounded-[12px] p-6 shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
          <h3 className="text-[15px] font-medium text-[#0A2540] mb-4">Top Triggered Rules</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {dashboardData.top_rules_triggered.map((item, i) => (
              <div key={i} className="p-3 bg-[#fff5f5] border border-[#ffcdcd] rounded-[8px] text-center">
                <span className="text-[18px] font-mono font-light text-[#df1b41]">{item.count}</span>
                <p className="text-[10px] uppercase tracking-wider text-[#425466] font-semibold mt-1 truncate">{item.rule?.replace(/_/g, ' ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Threat Perception Chart */}
      <div className="bg-white border border-[#e3e8ee] rounded-[12px] p-6 shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 border-b border-[#e3e8ee] pb-4 gap-2">
           <div>
             <h3 className="text-[15px] font-medium text-[#0A2540]">Threat Perception (Live)</h3>
             <p className="text-[12px] text-[#6B7C93] mt-0.5 flex items-center gap-2">
               <span className="flex items-center gap-1">
                 <span className="w-3 h-0.5 bg-[#df1b41] rounded-full inline-block"></span>
                 Risk Score
               </span>
             </p>
           </div>
           <span className="text-[11px] font-medium text-[#6B7C93] font-mono bg-[#f6f9fc] border border-[#e3e8ee] px-2.5 py-1 rounded">Poll: 5s</span>
        </div>

        <div className="min-h-[320px] h-[320px] w-full relative">
          {chartHistory.length === 0 ? (
            <div className="h-full flex items-center justify-center border border-dashed border-[#e3e8ee] bg-[#f6f9fc] rounded-[8px]">
              <div className="text-center space-y-2">
                <span className="material-symbols-outlined text-[32px] text-[#e3e8ee]">monitoring</span>
                <p className="text-[12px] font-medium text-[#6B7C93]">Collecting data points...</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320} minWidth={0} minHeight={0}>
              <AreaChart data={chartHistory} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#df1b41" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#df1b41" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#6B7C93" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#6B7C93" fontSize={11} tickLine={false} axisLine={false} domain={[0, 1]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e3e8ee',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    padding: '10px 14px',
                  }}
                  itemStyle={{fontSize: '12px', fontWeight: 500, color: '#0A2540'}}
                  labelStyle={{color: '#6B7C93', fontSize: '10px', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em'}}
                  formatter={(val, name) => {
                    const label = name === 'risk' ? 'Composite Risk' : name === 'ml_risk' ? 'ML P(Fraud)' : name;
                    return [typeof val === 'number' ? val.toFixed(4) : val, label];
                  }}
                />
                <Area
                  type="step"
                  dataKey="risk"
                  stroke="#df1b41"
                  strokeWidth={2}
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
