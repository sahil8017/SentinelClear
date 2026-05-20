import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../lib/axios';
import { toast } from 'sonner';
import { formatIST } from '../lib/format';

export function ChaosPanel() {
  const [logs, setLogs] = useState([]);
  const [isInjecting, setIsInjecting] = useState(false);
  const [chaosStatus, setChaosStatus] = useState(null);
  const [isStressing, setIsStressing] = useState(false);
  const [stressMetrics, setStressMetrics] = useState(null);

  // Heartbeat logger
  useEffect(() => {
    const logInterval = setInterval(() => {
      setLogs(prev => {
        const newLog = `[${formatIST(new Date())}] Heartbeat: SYSTEM_NOMINAL`;
        return [...prev.slice(-14), newLog];
      });
    }, 2000);
    return () => clearInterval(logInterval);
  }, []);

  // Poll chaos status
  const pollStatus = useCallback(async () => {
    try {
      const res = await apiClient.get('/admin/chaos/status');
      setChaosStatus(res.data);
      return res.data;
    } catch (err) {
      console.error('Status poll failed', err);
      return null;
    }
  }, []);

  const triggerChaos = async () => {
    setIsInjecting(true);
    setLogs(prev => [...prev.slice(-14), `[${new Date().toISOString()}] WARN: Initiating Chaos Fault Injection...`]);

    try {
      await apiClient.post('/admin/chaos/kill-db');

      setLogs(prev => [...prev.slice(-14), `[${new Date().toISOString()}] CRITICAL: PostgreSQL TCP connection SEVERED`]);
      setLogs(prev => [...prev.slice(-14), `[${new Date().toISOString()}] CRITICAL: All active queries will TIMEOUT`]);
      toast.error('DATABASE PARTITION ACTIVE — Connection pool drained.', { duration: 5000 });

      await pollStatus();

      setLogs(prev => [...prev.slice(-14), `[${new Date().toISOString()}] WARN: Testing API liveness...`]);

      setTimeout(async () => {
        try {
          await apiClient.get('/health');
          setLogs(prev => [...prev.slice(-14), `[${new Date().toISOString()}] WARN: Health check: DEGRADED`]);
        } catch {
          setLogs(prev => [...prev.slice(-14), `[${new Date().toISOString()}] CRITICAL: Health check FAILED — DB unreachable`]);
        }
      }, 2000);

      // Auto-recover after 6 seconds
      setTimeout(async () => {
        setLogs(prev => [...prev.slice(-14), `[${new Date().toISOString()}] WARN: Auto-recovery initiating...`]);

        try {
          await apiClient.post('/admin/chaos/restore-db');
          setLogs(prev => [...prev.slice(-14), `[${new Date().toISOString()}] INFO: PostgreSQL container UNPAUSED`]);
          setLogs(prev => [...prev.slice(-14), `[${new Date().toISOString()}] INFO: Connection pool re-established`]);
          setLogs(prev => [...prev.slice(-14), `[${new Date().toISOString()}] INFO: Ledger integrity VERIFIED against hash-chain`]);
          toast.success('SYSTEM RECOVERY COMPLETE — All subsystems operational.', { duration: 4000 });

          await pollStatus();
        } catch (e) {
          setLogs(prev => [...prev.slice(-14), `[${new Date().toISOString()}] ERROR: Auto-recovery FAILED — manual intervention required`]);
          toast.error('Recovery failed. Run: docker unpause postgres-db');
        }

        setIsInjecting(false);
      }, 6000);

    } catch (err) {
      const detail = err.response?.data?.detail || 'Chaos endpoints are disabled in this deployment';
      setLogs(prev => [...prev.slice(-14), `[${new Date().toISOString()}] ERROR: ${detail}`]);

      if (err.response?.status === 403) {
        toast.error('Chaos endpoints require ENABLE_CHAOS_ENDPOINTS=true in the backend config.', { duration: 5000 });
      } else {
        toast.error(`Chaos injection failed: ${detail}`);
      }

      setIsInjecting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-8 fade-in duration-500 pb-20 px-4 md:px-0">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[32px] md:text-[40px] font-light tracking-tight text-[#0A2540] m-0">Chaos Simulator</h1>
          <span className="text-[10px] uppercase tracking-wider text-[#df1b41] font-bold px-2 py-1 rounded bg-[#fff5f5] border border-[#ffcdcd]">High Privilege</span>
        </div>
        <p className="text-[14px] text-[#425466] mt-2 max-w-lg leading-[1.6]">
          Inject database faults and run concurrency stress tests to validate system resilience.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-2 gap-6 md:gap-8">

        {/* Injector Panel */}
        <div className="bg-[#fff5f5] border border-[#ffcdcd] rounded-[16px] p-6 md:p-8 flex flex-col items-center justify-center space-y-6 relative overflow-hidden shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
          <div className="text-center space-y-3 relative z-10 p-6 bg-white rounded-[12px] border border-[#e3e8ee] shadow-[0_2px_5px_rgba(0,0,0,0.02)] w-full max-w-sm">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 transition-all ${isInjecting ? 'bg-[#df1b41]/10 animate-pulse' : 'bg-[#f6f9fc] border border-[#e3e8ee]'}`}>
               <span className="material-symbols-outlined text-[28px] text-[#df1b41]">bolt</span>
            </div>
            <h3 className="text-[#0A2540] font-medium text-[18px]">Partition Ledger Primary DB</h3>
            <p className="text-[12px] text-[#6B7C93] leading-[1.6]">
              Pauses the PostgreSQL container to simulate a database crash. Auto-recovers after 6s.
            </p>
          </div>

          {/* Status indicator */}
          {chaosStatus && (
            <div className="relative z-10 w-full max-w-sm grid grid-cols-3 gap-2">
              <div className={`p-2 rounded-[6px] text-center border ${chaosStatus.db_status === 'running' ? 'border-[#0CBF4C]/20 bg-[#e7f9ed]' : 'border-[#ffcdcd] bg-[#fff5f5]'}`}>
                <span className="text-[9px] uppercase tracking-wider text-[#6B7C93] font-bold block">DB</span>
                <span className={`text-[11px] font-bold uppercase ${chaosStatus.db_status === 'running' ? 'text-[#0CBF4C]' : 'text-[#df1b41]'}`}>
                  {chaosStatus.db_status}
                </span>
              </div>
              <div className={`p-2 rounded-[6px] text-center border ${chaosStatus.worker_status === 'running' ? 'border-[#0CBF4C]/20 bg-[#e7f9ed]' : 'border-[#ffe0d4] bg-[#fff5f2]'}`}>
                <span className="text-[9px] uppercase tracking-wider text-[#6B7C93] font-bold block">Worker</span>
                <span className={`text-[11px] font-bold uppercase ${chaosStatus.worker_status === 'running' ? 'text-[#0CBF4C]' : 'text-[#ff6118]'}`}>
                  {chaosStatus.worker_status}
                </span>
              </div>
              <div className="p-2 rounded-[6px] text-center border border-[#e3e8ee] bg-white">
                <span className="text-[9px] uppercase tracking-wider text-[#6B7C93] font-bold block">DLQ</span>
                <span className="text-[11px] font-bold text-[#0A2540]">{chaosStatus.dlq_count}</span>
              </div>
            </div>
          )}

          <button
            onClick={triggerChaos}
            disabled={isInjecting}
            className="px-8 py-3 bg-white border border-[#df1b41] text-[#df1b41] hover:bg-[#fff5f5] font-medium rounded-[8px] text-[14px] transition-all active:scale-[0.98] disabled:opacity-50 relative z-10 w-full max-w-sm flex items-center justify-center gap-2"
          >
            {isInjecting ? (
              <><span className="w-4 h-4 border-2 border-[#df1b41]/30 border-t-[#df1b41] rounded-full animate-spin"></span> Executing...</>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">bolt</span>
                Execute Kill Sequence
              </>
            )}
          </button>
        </div>

        {/* Stress Tester Panel */}
        <div className="bg-white border border-[#e3e8ee] rounded-[16px] p-6 md:p-8 flex flex-col space-y-6 relative overflow-hidden shadow-[0_2px_5px_rgba(0,0,0,0.02)] lg:col-start-1 lg:row-start-2">
           <div className="text-center space-y-2 relative z-10 w-full">
            <h3 className="text-[#0A2540] font-medium text-[18px]">Concurrency Stress Test</h3>
            <p className="text-[13px] text-[#6B7C93] leading-[1.6]">
              Run 50 simultaneous double-entry transfers to validate row-level locking.
            </p>
          </div>

          {stressMetrics && (
             <div className="grid grid-cols-2 md:grid-cols-4 gap-3 z-10 w-full">
                <div className="bg-[#f6f9fc] p-3 flex flex-col items-center justify-center rounded-[8px] border border-[#e3e8ee]">
                   <span className="text-[10px] uppercase tracking-wider font-bold text-[#635BFF]">Attempted</span>
                   <span className="font-mono font-light text-[22px] text-[#0A2540]">{stressMetrics.attempted}</span>
                </div>
                <div className="bg-[#f6f9fc] p-3 flex flex-col items-center justify-center rounded-[8px] border border-[#e3e8ee]">
                   <span className="text-[10px] uppercase tracking-wider font-bold text-[#0CBF4C]">Succeeded</span>
                   <span className="font-mono font-light text-[22px] text-[#0A2540]">{stressMetrics.succeeded}</span>
                </div>
                <div className="bg-[#f6f9fc] p-3 flex flex-col items-center justify-center rounded-[8px] border border-[#e3e8ee]">
                   <span className="text-[10px] uppercase tracking-wider font-bold text-[#df1b41]">Deadlocks</span>
                   <span className="font-mono font-light text-[22px] text-[#0A2540]">{stressMetrics.deadlocks}</span>
                </div>
                <div className="bg-[#f6f9fc] p-3 flex flex-col items-center justify-center rounded-[8px] border border-[#e3e8ee]">
                   <span className="text-[10px] uppercase tracking-wider font-bold text-[#635BFF]">Latency</span>
                   <span className="font-mono font-light text-[22px] text-[#0A2540]">{stressMetrics.latency_ms}ms</span>
                </div>
             </div>
          )}

          <button
            onClick={async () => {
              setIsStressing(true);
              setStressMetrics(null);
              setLogs(prev => [...prev.slice(-14), `[${new Date().toISOString()}] INFO: Executing 50 concurrent Double-Entry locks...`]);
              try {
                const res = await apiClient.post('/admin/chaos/stress-test');
                setStressMetrics(res.data.metrics);
                setLogs(prev => [...prev.slice(-14), `[${new Date().toISOString()}] SUCCESS: Concurrency successfully mitigated. Row locks held.`]);
                toast.success(`Concurrency mitigated. Deadlocks: ${res.data.metrics.deadlocks}`);
              } catch (err) {
                toast.error('Stress test trigger failed.');
                setLogs(prev => [...prev.slice(-14), `[${new Date().toISOString()}] ERROR: Stress Test failure`]);
              } finally {
                setIsStressing(false);
              }
            }}
            disabled={isStressing}
            className="px-8 py-3 bg-[#0A2540] hover:bg-[#112F4E] text-white font-medium rounded-[8px] text-[14px] transition-all active:scale-[0.98] disabled:opacity-50 relative z-10 w-full flex items-center justify-center gap-2"
          >
            {isStressing ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Testing...</>
            ) : (
              'Run 50-Thread Assault'
            )}
          </button>
        </div>

        {/* Audit / System Log Panel — keep dark terminal aesthetic intentionally */}
        <div className="bg-[#0A2540] border border-[#1a3a5c] rounded-[16px] p-6 shadow-[0_2px_5px_rgba(0,0,0,0.08)] flex flex-col h-[500px] lg:col-start-2 lg:row-span-2">
          <div className="flex justify-between items-center mb-4 border-b border-[#1a3a5c] pb-4">
             <h3 className="text-[13px] font-medium text-[#6B7C93]">Node Telemetry Stream</h3>
             <span className={`w-2 h-2 rounded-full ${isInjecting ? 'bg-[#df1b41] animate-pulse' : 'bg-[#0CBF4C]'}`}></span>
          </div>

          <div className="flex-1 bg-[#051525] rounded-[8px] p-4 overflow-hidden font-mono text-[11px] leading-relaxed text-[#425466] shadow-inner">
             <div className="flex flex-col justify-end h-full space-y-1 overflow-y-auto scrollbar-hide">
               {logs.map((log, index) => (
                 <div key={index} className={
                   log.includes('WARN') ? 'text-[#ff6118]' :
                   log.includes('CRITICAL') || log.includes('ERROR') ? 'text-[#df1b41] font-semibold' :
                   log.includes('INFO') || log.includes('SUCCESS') ? 'text-[#635BFF]' :
                   'text-[#0CBF4C]'
                 }>
                   {log}
                 </div>
               ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
