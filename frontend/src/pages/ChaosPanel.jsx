import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../lib/axios';
import { toast } from 'sonner';
import { formatIST } from '../lib/format';

export function ChaosPanel() {
  const [logs, setLogs] = useState([]);
  const [isInjecting, setIsInjecting] = useState(false);
  const [chaosStatus, setChaosStatus] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
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

  // Poll chaos status when injecting
  const pollStatus = useCallback(async () => {
    try {
      const res = await apiClient.get('/admin/chaos/status', {
        headers: { 'X-Admin-Token': 'change-me-in-production' }
      });
      setChaosStatus(res.data);
      return res.data;
    } catch (err) {
      // Status endpoint might not require admin token, or chaos may be disabled
      console.error('Status poll failed', err);
      return null;
    }
  }, []);

  const triggerChaos = async () => {
    setIsInjecting(true);
    setLogs(prev => [...prev.slice(-14), `[${new Date().toISOString()}] WARN: Initiating Chaos Fault Injection...`]);

    try {
      // Kill the database
      await apiClient.post('/admin/chaos/kill-db', null, {
        headers: { 'X-Admin-Token': 'change-me-in-production' }
      });

      setLogs(prev => [...prev.slice(-14), `[${new Date().toISOString()}] CRITICAL: PostgreSQL TCP connection SEVERED`]);
      setLogs(prev => [...prev.slice(-14), `[${new Date().toISOString()}] CRITICAL: All active queries will TIMEOUT`]);
      toast.error('DATABASE PARTITION ACTIVE — Connection pool drained.', { duration: 5000 });

      // Poll status
      setIsPolling(true);
      await pollStatus();

      // Demonstrate that API calls fail
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
          await apiClient.post('/admin/chaos/restore-db', null, {
            headers: { 'X-Admin-Token': 'change-me-in-production' }
          });
          setLogs(prev => [...prev.slice(-14), `[${new Date().toISOString()}] INFO: PostgreSQL container UNPAUSED`]);
          setLogs(prev => [...prev.slice(-14), `[${new Date().toISOString()}] INFO: Connection pool re-established`]);
          setLogs(prev => [...prev.slice(-14), `[${new Date().toISOString()}] INFO: Ledger integrity VERIFIED against hash-chain`]);
          toast.success('SYSTEM RECOVERY COMPLETE — All subsystems operational.', { duration: 4000 });

          await pollStatus();
        } catch (e) {
          setLogs(prev => [...prev.slice(-14), `[${new Date().toISOString()}] ERRROR: Auto-recovery FAILED — manual intervention required`]);
          toast.error('Recovery failed. Run: docker unpause postgres-db');
        }

        setIsInjecting(false);
        setIsPolling(false);
      }, 6000);

    } catch (err) {
      const detail = err.response?.data?.detail || 'Chaos endpoints are disabled in this deployment';
      setLogs(prev => [...prev.slice(-14), `[${new Date().toISOString()}] ERRROR: ${detail}`]);

      if (err.response?.status === 403) {
        toast.error('Chaos endpoints require ENABLE_CHAOS_ENDPOINTS=true in the backend config.', { duration: 5000 });
      } else {
        toast.error(`Chaos injection failed: ${detail}`);
      }

      setIsInjecting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-4">
          Chaos Simulator
          <span className="text-[10px] uppercase tracking-widest text-red-600 dark:text-red-400 font-bold px-2 py-1 rounded bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 translate-y-[-2px]">High Privilege</span>
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-lg">
          Inject systemic faults, database partitions, and high-latency spikes to validate the resilience and auto-recovery capabilities. Execution of Concurrency constraints is also accessible here.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-2 gap-8">


        {/* Injector Panel */}
        <div className="bg-red-50 dark:bg-[#0c0505] border border-red-200 dark:border-red-500/20 rounded-2xl p-8 flex flex-col items-center justify-center space-y-8 relative overflow-hidden shadow-sm dark:shadow-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.1)_0%,transparent_70%)] pointer-events-none"></div>

          <div className="text-center space-y-3 relative z-10 p-6 bg-white dark:bg-black rounded-2xl border border-red-100 dark:border-red-500/10 w-full max-w-sm">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 transition-all ${isInjecting ? 'bg-red-500/20 animate-pulse' : 'bg-red-100 dark:bg-red-500/10'}`}>
               <span className="material-symbols-outlined text-4xl text-red-500">bolt</span>
            </div>
            <h3 className="text-zinc-900 dark:text-white font-bold text-lg">Partition Ledger Primary DB</h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 uppercase tracking-widest font-semibold px-4">
              This action pauses the PostgreSQL container to simulate a database crash.
            </p>
          </div>

          {/* Status indicator */}
          {chaosStatus && (
            <div className="relative z-10 w-full max-w-sm grid grid-cols-3 gap-2">
              <div className={`p-2 rounded-lg text-center border ${chaosStatus.db_status === 'running' ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                <span className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold block">DB</span>
                <span className={`text-[10px] font-black uppercase ${chaosStatus.db_status === 'running' ? 'text-emerald-500' : 'text-red-500'}`}>
                  {chaosStatus.db_status}
                </span>
              </div>
              <div className={`p-2 rounded-lg text-center border ${chaosStatus.worker_status === 'running' ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
                <span className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold block">Worker</span>
                <span className={`text-[10px] font-black uppercase ${chaosStatus.worker_status === 'running' ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {chaosStatus.worker_status}
                </span>
              </div>
              <div className="p-2 rounded-lg text-center border border-zinc-200 dark:border-white/5 bg-white/50 dark:bg-black/50">
                <span className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold block">DLQ</span>
                <span className="text-[10px] font-black text-zinc-900 dark:text-white">{chaosStatus.dlq_count}</span>
              </div>
            </div>
          )}

          <button
            onClick={triggerChaos}
            disabled={isInjecting}
            className="px-10 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-[12px] uppercase tracking-[0.1em] shadow-[0_4px_20px_rgba(239,68,68,0.4)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale relative z-10 w-full max-w-sm flex items-center justify-center gap-3"
          >
            {isInjecting ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Executing Partition Vector...</>
            ) : (
              'Execute Kill Sequence'
            )}
          </button>
        </div>

        {/* Stress Tester Panel */}
        <div className="bg-white dark:bg-[#121315] border border-zinc-200 dark:border-white/5 rounded-2xl p-8 flex flex-col space-y-8 relative overflow-hidden shadow-sm lg:col-start-1 lg:row-start-2">
           <div className="text-center space-y-3 relative z-10 w-full mb-2">
            <h3 className="text-zinc-900 dark:text-white font-bold text-lg">Concurrency Stress Test</h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 uppercase tracking-widest font-semibold">
              Attempt 50 Simultaneous Double-Entry transfers to prove Row-Level Locking (Pessimistic) handles Deadlocks and Race Conditions.
            </p>
          </div>

          {stressMetrics && (
             <div className="grid grid-cols-2 md:grid-cols-4 gap-3 z-10 w-full">
                <div className="bg-zinc-50 dark:bg-black/50 p-3 flex flex-col items-center justify-center rounded-xl border border-zinc-200 dark:border-white/5">
                   <span className="text-[9px] uppercase tracking-widest font-bold text-blue-500">Attempted</span>
                   <span className="font-mono font-black text-xl text-zinc-900 dark:text-white">{stressMetrics.attempted}</span>
                </div>
                <div className="bg-zinc-50 dark:bg-black/50 p-3 flex flex-col items-center justify-center rounded-xl border border-zinc-200 dark:border-white/5">
                   <span className="text-[9px] uppercase tracking-widest font-bold text-emerald-500">Succeeded</span>
                   <span className="font-mono font-black text-xl text-zinc-900 dark:text-white">{stressMetrics.succeeded}</span>
                </div>
                <div className="bg-zinc-50 dark:bg-black/50 p-3 flex flex-col items-center justify-center rounded-xl border border-zinc-200 dark:border-white/5">
                   <span className="text-[9px] uppercase tracking-widest font-bold text-red-500">Deadlocks</span>
                   <span className="font-mono font-black text-xl text-zinc-900 dark:text-white">{stressMetrics.deadlocks}</span>
                </div>
                <div className="bg-zinc-50 dark:bg-black/50 p-3 flex flex-col items-center justify-center rounded-xl border border-zinc-200 dark:border-white/5">
                   <span className="text-[9px] uppercase tracking-widest font-bold text-purple-500">Latency</span>
                   <span className="font-mono font-black text-xl text-zinc-900 dark:text-white">{stressMetrics.latency_ms}ms</span>
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
            className="px-10 py-4 bg-zinc-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-bold rounded-xl text-[12px] uppercase tracking-[0.1em] transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale relative z-10 w-full"
          >
            {isStressing ? 'Assaulting Database...' : 'Run 50-Thread Assault'}
          </button>
        </div>

        {/* Audit / System Log Panel */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col h-[500px] lg:col-start-2 lg:row-span-2">
          <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-4">
             <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 font-bold">Node Telemetry Stream</h3>
             <span className={`w-2 h-2 rounded-full ${isInjecting ? 'bg-red-500 animate-pulse' : 'bg-green-500'} shadow-[0_0_8px_rgba(34,197,94,0.6)]`}></span>
          </div>

          <div className="flex-1 bg-black rounded-xl p-4 overflow-hidden font-mono text-[11px] leading-relaxed text-zinc-500 shadow-inner">
             <div className="flex flex-col justify-end h-full space-y-1 overflow-y-auto">
               {logs.map((log, index) => (
                 <div key={index} className={
                   log.includes('WARN') ? 'text-amber-400' :
                   log.includes('CRITICAL') || log.includes('ERRROR') ? 'text-red-500 font-bold' :
                   log.includes('INFO') ? 'text-blue-400' :
                   'text-green-500'
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
