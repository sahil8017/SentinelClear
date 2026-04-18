import React, { useEffect, useState, useCallback, useContext, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import apiClient from '../lib/axios';
import { ThemeContext } from '../App';

export function AMLGraph() {
  const { isDark } = useContext(ThemeContext);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [stats, setStats] = useState(null);
  const [clusters, setClusters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hours, setHours] = useState(168);
  const [selectedNode, setSelectedNode] = useState(null);

  const fetchGraph = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/aml/network-graph?hours=${hours}`);
      const data = res.data;
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
      setStats(data.stats || {});
      setClusters(data.clusters || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load AML graph');
    } finally {
      setIsLoading(false);
    }
  }, [hours]);

  useEffect(() => { fetchGraph(); }, [fetchGraph]);

  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node);
  }, []);

  const threatColor = (level) => {
    if (level === 'CRITICAL') return 'text-red-500';
    if (level === 'ELEVATED') return 'text-amber-500';
    return 'text-emerald-500';
  };

  const threatBg = (level) => {
    if (level === 'CRITICAL') return 'bg-red-500/10 border-red-500/20';
    if (level === 'ELEVATED') return 'bg-amber-500/10 border-amber-500/20';
    return 'bg-emerald-500/10 border-emerald-500/20';
  };

  return (
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/20">
              <span className="material-symbols-outlined text-white text-xl">hub</span>
            </div>
            <div>
              <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">AML Network Graph</h1>
              <p className="text-xs text-zinc-500 font-medium mt-0.5">Threat Intelligence · Money Mule Detection</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="text-xs font-bold bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-lg px-3 py-2 text-zinc-700 dark:text-zinc-300 outline-none"
          >
            <option value={24}>Last 24 Hours</option>
            <option value={72}>Last 3 Days</option>
            <option value={168}>Last 7 Days</option>
            <option value={720}>Last 30 Days</option>
          </select>
          <button
            onClick={fetchGraph}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white text-xs font-bold rounded-lg shadow-lg shadow-red-500/20 hover:shadow-red-500/40 transition-all"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Scan Network
          </button>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Active Nodes', value: stats.total_accounts, icon: 'account_circle', color: 'text-indigo-500' },
            { label: 'Fund Flows', value: stats.total_flows, icon: 'swap_horiz', color: 'text-blue-500' },
            { label: 'Flagged Flows', value: stats.flagged_flows, icon: 'flag', color: 'text-red-500' },
            { label: 'Total Volume', value: `₹${(stats.total_volume || 0).toLocaleString('en-IN')}`, icon: 'payments', color: 'text-emerald-500' },
            { label: 'High-Risk Nodes', value: stats.high_risk_nodes, icon: 'warning', color: 'text-amber-500' },
          ].map((s, i) => (
            <div key={i} className="bg-white dark:bg-[#0a0a0b] border border-zinc-200 dark:border-white/5 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className={`material-symbols-outlined text-base ${s.color}`}>{s.icon}</span>
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{s.label}</span>
              </div>
              <p className="text-xl font-black text-zinc-900 dark:text-white">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Main Content ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* ── Graph Canvas ── */}
        <div className="lg:col-span-3 bg-white dark:bg-[#060607] border border-zinc-200 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm" style={{ height: '620px' }}>
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Scanning Transfer Network...</p>
              </div>
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-2">
                <span className="material-symbols-outlined text-4xl text-red-500">error</span>
                <p className="text-sm font-bold text-red-500">{error}</p>
              </div>
            </div>
          ) : nodes.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-2">
                <span className="material-symbols-outlined text-4xl text-zinc-300 dark:text-zinc-700">hub</span>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">No transfer activity in this window</p>
              </div>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              fitView
              attributionPosition="bottom-left"
              style={{ background: isDark ? '#060607' : '#fafafa' }}
              proOptions={{ hideAttribution: true }}
            >
              <Controls
                style={{ 
                  background: isDark ? '#18181b' : '#fff', 
                  borderRadius: '12px', 
                  border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #e4e4e7',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
              />
              <Background
                color={isDark ? '#1a1a1d' : '#e4e4e7'}
                gap={20}
                size={1}
              />
              <MiniMap
                style={{
                  background: isDark ? '#0a0a0b' : '#f4f4f5',
                  borderRadius: '12px',
                  border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #e4e4e7',
                }}
                nodeColor={(n) => n.style?.background || '#6366f1'}
                maskColor={isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.1)'}
              />
            </ReactFlow>
          )}
        </div>

        {/* ── Sidebar: Clusters + Node Inspector ── */}
        <div className="space-y-4">
          {/* Node Inspector */}
          <div className="bg-white dark:bg-[#0a0a0b] border border-zinc-200 dark:border-white/5 rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-indigo-500">person_search</span>
              Node Inspector
            </h3>
            {selectedNode ? (
              <div className="space-y-3">
                <div>
                  <p className="text-[9px] text-zinc-400 uppercase tracking-widest">Identity</p>
                  <p className="text-sm font-black text-zinc-900 dark:text-white">{selectedNode.data.label}</p>
                  <p className="text-[9px] text-zinc-500 font-mono mt-0.5">{selectedNode.id.substring(0, 18)}...</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-zinc-50 dark:bg-white/5 rounded-lg p-2.5">
                    <p className="text-[8px] text-zinc-400 uppercase tracking-widest">Risk Score</p>
                    <p className={`text-lg font-black ${selectedNode.data.risk_score >= 0.7 ? 'text-red-500' : selectedNode.data.risk_score >= 0.4 ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {(selectedNode.data.risk_score * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-zinc-50 dark:bg-white/5 rounded-lg p-2.5">
                    <p className="text-[8px] text-zinc-400 uppercase tracking-widest">Transactions</p>
                    <p className="text-lg font-black text-zinc-900 dark:text-white">{selectedNode.data.tx_count}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-zinc-50 dark:bg-white/5 rounded-lg p-2.5">
                    <p className="text-[8px] text-zinc-400 uppercase tracking-widest">Total Outflow</p>
                    <p className="text-sm font-bold text-red-500">₹{selectedNode.data.total_out.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="bg-zinc-50 dark:bg-white/5 rounded-lg p-2.5">
                    <p className="text-[8px] text-zinc-400 uppercase tracking-widest">Total Inflow</p>
                    <p className="text-sm font-bold text-emerald-500">₹{selectedNode.data.total_in.toLocaleString('en-IN')}</p>
                  </div>
                </div>
                {selectedNode.data.is_flagged && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-red-500">gpp_bad</span>
                    <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">{selectedNode.data.flagged} Flagged Transaction{selectedNode.data.flagged > 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center border-2 border-dashed border-zinc-100 dark:border-white/5 rounded-xl">
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Click a node to inspect</p>
              </div>
            )}
          </div>

          {/* Cluster Intelligence */}
          <div className="bg-white dark:bg-[#0a0a0b] border border-zinc-200 dark:border-white/5 rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-red-500">share</span>
              Cluster Intelligence
            </h3>
            {clusters.length === 0 ? (
              <div className="h-24 flex items-center justify-center border-2 border-dashed border-zinc-100 dark:border-white/5 rounded-xl">
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">No clusters detected</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {clusters.map((c, i) => (
                  <div key={i} className={`border rounded-xl p-3 ${threatBg(c.threat_level)}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[9px] font-black uppercase tracking-widest ${threatColor(c.threat_level)}`}>
                        {c.threat_level}
                      </span>
                      <span className="text-[9px] font-bold text-zinc-500">{c.size} nodes</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                        Risk: {(c.max_risk * 100).toFixed(1)}%
                      </span>
                      <span className="text-xs font-bold text-zinc-500">
                        ₹{c.total_volume.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="bg-white dark:bg-[#0a0a0b] border border-zinc-200 dark:border-white/5 rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Legend</h3>
            <div className="space-y-2">
              {[
                { color: 'bg-emerald-500', label: 'Low Risk (< 40%)' },
                { color: 'bg-amber-500', label: 'Medium Risk (40–70%)' },
                { color: 'bg-red-500', label: 'High Risk (≥ 70%)' },
              ].map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${l.color}`}></div>
                  <span className="text-[10px] font-medium text-zinc-500">{l.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-zinc-100 dark:border-white/5">
                <div className="w-8 h-0.5 bg-indigo-500 rounded-full"></div>
                <span className="text-[10px] font-medium text-zinc-500">Normal Flow</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-[10px] font-medium text-zinc-500">Flagged Flow (Animated)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
