import React, { useEffect, useState, useCallback, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import apiClient from '../lib/axios';
import { toast } from 'sonner';

export function AMLGraph() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [clusters, setClusters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hours, setHours] = useState(168);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoverNode, setHoverNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [minRisk, setMinRisk] = useState(0);
  const [stats, setStats] = useState(null);
  const graphRef = useRef();
  const isMountedRef = useRef(true);
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 800, height: 650 });

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width || 800,
          height: entry.contentRect.height || 650
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (graphRef.current && graphData.nodes.length > 0) {
      const timer = setTimeout(() => {
        if (graphRef.current) {
          graphRef.current.zoomToFit(400, 50);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [graphData]);

  const fetchGraph = useCallback(async () => {
    if (!isMountedRef.current) return;
    setIsLoading(true);
    setError(null);
    try {
      // Fetch both network and circular trading data per specifications
      const [networkRes, circularRes] = await Promise.allSettled([
        apiClient.get(`/aml/network-graph?hours=${hours}`),
        apiClient.get(`/aml/circular-trading?hours=${hours}`)
      ]);

      const netData = networkRes.status === 'fulfilled' ? networkRes.value.data : {};
      const circData = circularRes.status === 'fulfilled' ? circularRes.value.data : {};

      // Combine Nodes (Deduplicate by ID)
      const nodeMap = new Map();
      const processNodes = (nodesToProcess) => {
        (nodesToProcess || []).forEach(node => {
          if (!nodeMap.has(node.id)) {
            // Transform for ForceGraph: Ensure visual properties are set
            nodeMap.set(node.id, {
              id: node.id,
              label: node.data?.label || node.id.substring(0, 8),
              risk_score: node.data?.risk_score || 0,
              tx_count: node.data?.tx_count || 0,
              total_in: node.data?.total_in || 0,
              total_out: node.data?.total_out || 0,
              is_flagged: node.data?.is_flagged || false,
              flagged: node.data?.flagged || 0,
              // Size proportional to volume (scale logarithmically to avoid giant nodes)
              val: Math.max(6, Math.log10((node.data?.total_in || 0) + (node.data?.total_out || 0) + 1) * 3)
            });
          }
        });
      };
      processNodes(netData.nodes);
      processNodes(circData.nodes);

      // Combine Edges -> Links (ForceGraph expects 'source' and 'target')
      const linkMap = new Map();
      const processEdges = (edgesToProcess) => {
        (edgesToProcess || []).forEach(edge => {
          const key = `${edge.source}-${edge.target}`;
          if (!linkMap.has(key)) {
            linkMap.set(key, {
              source: edge.source,
              target: edge.target,
              is_flagged: edge.data?.is_flagged || false,
              amount: edge.data?.amount || 0,
            });
          }
        });
      };
      processEdges(netData.edges);
      processEdges(circData.edges);

      if (isMountedRef.current) {
        setGraphData({
          nodes: Array.from(nodeMap.values()),
          links: Array.from(linkMap.values())
        });
        setStats(netData.stats || null);
        setClusters(circData.clusters || netData.clusters || []);
      }

    } catch (err) {
      console.error(err);
      if (isMountedRef.current) {
        setError('Failed to aggregate AML data from Neo4j.');
        toast.error('Failed to load AML intelligence network.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [hours]);

  useEffect(() => { 
    fetchGraph(); 
  }, [fetchGraph]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Null out the ForceGraph ref to stop canvas animation callbacks
      // from firing postMessage to a closed port after unmount
      if (graphRef.current) {
        graphRef.current = null;
      }
    };
  }, []);

  const handleNodeClick = useCallback((node) => {
    if (!isMountedRef.current) return;
    setSelectedNode(node);
    // Center the camera on the clicked node
    if (graphRef.current) {
      graphRef.current.centerAt(node.x, node.y, 1000);
      graphRef.current.zoom(4, 1000);
    }
  }, []);

  const getNodeColor = (node) => {
    // Stripe Red (#df1b41) for high risk, Stripe Green (#0CBF4C) for low risk, Amber for medium
    if (node.risk_score >= 0.7) return '#df1b41'; 
    if (node.risk_score >= 0.4) return '#f59e0b';
    return '#0CBF4C';
  };

  const filteredGraphData = React.useMemo(() => {
    const nodes = graphData.nodes.filter(n => {
      const matchesRisk = n.risk_score >= minRisk;
      const matchesSearch = !searchQuery || n.id.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesRisk && matchesSearch;
    });
    const nodeIds = new Set(nodes.map(n => n.id));
    const links = graphData.links.filter(l => {
        const src = typeof l.source === 'object' ? l.source.id : l.source;
        const tgt = typeof l.target === 'object' ? l.target.id : l.target;
        return nodeIds.has(src) && nodeIds.has(tgt);
    });
    return { nodes, links };
  }, [graphData, minRisk, searchQuery]);

  const highlightNodes = React.useMemo(() => {
    const set = new Set();
    if (hoverNode || selectedNode) {
      const activeNodeId = hoverNode ? hoverNode.id : selectedNode.id;
      set.add(activeNodeId);
      filteredGraphData.links.forEach(l => {
        const src = typeof l.source === 'object' ? l.source.id : l.source;
        const tgt = typeof l.target === 'object' ? l.target.id : l.target;
        if (src === activeNodeId) set.add(tgt);
        if (tgt === activeNodeId) set.add(src);
      });
    }
    return set;
  }, [hoverNode, selectedNode, filteredGraphData.links]);

  const paintNode = useCallback((node, ctx, globalScale) => {
    const isActiveScope = hoverNode || selectedNode;
    const isHighlight = isActiveScope ? highlightNodes.has(node.id) : true;
    const isSearched = searchQuery && node.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Draw Pulse for flagged
    if (node.is_flagged && isHighlight) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.val * 1.5, 0, 2 * Math.PI, false);
      ctx.fillStyle = `rgba(223, 27, 65, ${0.15 + Math.abs(Math.sin(Date.now() / 400)) * 0.25})`;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
    
    if (!isHighlight) {
      ctx.fillStyle = 'rgba(227, 232, 238, 0.4)'; // highly dimmed
    } else {
      if (node.risk_score >= 0.7) ctx.fillStyle = '#df1b41'; 
      else if (node.risk_score >= 0.4) ctx.fillStyle = '#f59e0b';
      else ctx.fillStyle = '#0CBF4C';
    }
    
    ctx.fill();

    if (isSearched) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.val + 2, 0, 2 * Math.PI, false);
      ctx.strokeStyle = '#635BFF';
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    }

    if (isHighlight && (globalScale > 0.8 || isActiveScope)) {
      const fontSize = Math.max(10 / globalScale, 4);
      ctx.font = `${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0A2540';
      ctx.fillText(node.label, node.x, node.y + node.val + fontSize + 2);
    }
  }, [hoverNode, selectedNode, highlightNodes, searchQuery]);

  const connectedPeers = React.useMemo(() => {
    if (!selectedNode) return [];
    return filteredGraphData.links.filter(l => 
      (typeof l.source === 'object' ? l.source.id : l.source) === selectedNode.id || 
      (typeof l.target === 'object' ? l.target.id : l.target) === selectedNode.id
    ).map(l => {
      const srcId = typeof l.source === 'object' ? l.source.id : l.source;
      const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
      const isOutbound = srcId === selectedNode.id;
      const peerId = isOutbound ? tgtId : srcId;
      return { id: peerId, isOutbound, amount: l.amount || 0, is_flagged: l.is_flagged || false };
    });
  }, [selectedNode, filteredGraphData.links]);

  return (
    <div className="space-y-6 pt-4 pb-12 max-w-[1600px] mx-auto bg-white min-h-screen">
      
      {/* ── Stripe Light-Mode Header ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded bg-[#f6f9fc] border border-[#e3e8ee] flex items-center justify-center shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
            <span className="material-symbols-outlined text-[#635BFF] text-2xl font-light">account_tree</span>
          </div>
          <div>
            <h1 className="text-2xl font-light text-[#0A2540] tracking-tight m-0">AML Graph Intelligence</h1>
            <p className="text-[13px] text-[#6B7C93] font-medium mt-1">Neo4j Topologies · Cypher Query Analysis</p>
          </div>
        </div>
        <div className="flex flex-col lg:flex-row items-end lg:items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
          <div className="relative w-full lg:w-48">
             <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-[#6B7C93] text-[18px]">search</span>
             <input 
               type="text" 
               placeholder="Search UUID..." 
               value={searchQuery}
               onChange={e => setSearchQuery(e.target.value)}
               className="text-[13px] font-medium bg-white w-full border border-[#e3e8ee] rounded pl-9 pr-4 py-2 w-full text-[#0A2540] outline-none focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/20 shadow-[0_2px_5px_rgba(0,0,0,0.02)]"
             />
          </div>
          
          <div className="flex items-center gap-2 bg-white border border-[#e3e8ee] rounded px-3 py-1.5 shadow-[0_2px_5px_rgba(0,0,0,0.02)] w-full lg:w-auto h-9">
             <span className="text-[11px] font-bold text-[#6B7C93] uppercase tracking-wider whitespace-nowrap">Risk {'>='} {(minRisk * 100).toFixed(0)}%</span>
             <input 
               type="range" 
               min="0" max="1" step="0.1" 
               value={minRisk}
               onChange={e => setMinRisk(Number(e.target.value))}
               className="w-16 md:w-20 accent-[#df1b41]"
             />
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto">
            <select
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="text-[13px] font-medium bg-white border border-[#e3e8ee] rounded px-4 py-2 text-[#0A2540] outline-none focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/20 shadow-[0_2px_5px_rgba(0,0,0,0.02)] h-9 flex-1 lg:flex-none"
            >
              <option value={24}>Past 24 Hours</option>
              <option value={72}>Past 3 Days</option>
              <option value={168}>Past 7 Days</option>
              <option value={720}>Past 30 Days</option>
            </select>
            <button
              onClick={fetchGraph}
              className="flex items-center justify-center gap-2 px-5 py-2 bg-[#0A2540] text-white text-[13px] font-medium rounded hover:bg-[#112F4E] shadow-[0_2px_5px_rgba(0,0,0,0.1)] transition-colors h-9"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats Strip ── */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Active Entities', value: stats.total_accounts, icon: 'person' },
            { label: 'Edges Mapped', value: stats.total_flows, icon: 'route' },
            { label: 'Flagged Routes', value: stats.flagged_flows, icon: 'flag', alert: true },
            { label: 'Volume Analyzed', value: `₹${(stats.total_volume || 0).toLocaleString('en-IN')}`, icon: 'payments' },
            { label: 'High-Risk Nodes', value: stats.high_risk_nodes, icon: 'warning', alert: true },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-[#e3e8ee] rounded shadow-[0_2px_5px_rgba(0,0,0,0.02)] p-4 flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-3">
                <span className={`material-symbols-outlined text-[18px] ${s.alert ? 'text-[#df1b41]' : 'text-[#635BFF]'}`}>{s.icon}</span>
                <span className="text-[11px] font-medium text-[#6B7C93] uppercase tracking-wider">{s.label}</span>
              </div>
              <p className={`text-2xl font-light tracking-tight ${s.alert && s.value > 0 ? 'text-[#df1b41]' : 'text-[#0A2540]'}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* ── Force-Directed Graph ── */}
        <div ref={containerRef} className="lg:col-span-3 bg-[#f6f9fc] border border-[#e3e8ee] rounded shadow-[inset_0_2px_10px_rgba(0,0,0,0.01)] overflow-hidden relative" style={{ height: '650px' }}>
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-10">
              <div className="text-center space-y-4">
                <div className="w-8 h-8 border-2 border-[#635BFF] border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-[13px] font-medium text-[#0A2540]">Running Cypher Queries...</p>
              </div>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
              <div className="text-center space-y-2">
                <span className="material-symbols-outlined text-3xl text-[#df1b41]">error</span>
                <p className="text-[13px] font-medium text-[#df1b41]">{error}</p>
              </div>
            </div>
          ) : filteredGraphData.nodes.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-[#6B7C93] mb-3">blur_off</span>
              <p className="text-[13px] font-medium text-[#6B7C93]">No topological data matches the current filters.</p>
            </div>
          ) : (
            <ForceGraph2D
              ref={graphRef}
              width={dimensions.width}
              height={dimensions.height}
              graphData={filteredGraphData}
              nodeVal="val"
              nodeLabel="id"
              nodeCanvasObject={paintNode}
              linkColor={(link) => {
                const isActiveScope = hoverNode || selectedNode;
                const srcId = typeof link.source === 'object' ? link.source.id : link.source;
                const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
                
                if (isActiveScope) {
                  const activeNodeId = hoverNode ? hoverNode.id : selectedNode.id;
                  const isLinked = srcId === activeNodeId || tgtId === activeNodeId;
                  if (!isLinked) return 'rgba(227, 232, 238, 0.4)';
                }
                return link.is_flagged ? '#df1b41' : '#b2c0d4';
              }}
              linkWidth={(link) => {
                const isActiveScope = hoverNode || selectedNode;
                if (isActiveScope && link.is_flagged) return 2;
                return link.is_flagged ? 1.5 : 1;
              }}
              linkDirectionalArrowLength={(link) => {
                const isActiveScope = hoverNode || selectedNode;
                if (isActiveScope) {
                   const activeNodeId = hoverNode ? hoverNode.id : selectedNode.id;
                   const isLinked = (typeof link.source === 'object' ? link.source.id : link.source) === activeNodeId || 
                                    (typeof link.target === 'object' ? link.target.id : link.target) === activeNodeId;
                   return isLinked ? 4 : 0;
                }
                return 4;
              }}
              linkDirectionalArrowRelPos={1}
              onNodeClick={handleNodeClick}
              onNodeHover={setHoverNode}
              onBackgroundClick={() => setSelectedNode(null)}
              backgroundColor="#f6f9fc"
              d3VelocityDecay={0.3} 
            />
          )}
          
          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur border border-[#e3e8ee] rounded p-3 shadow-sm pointer-events-none">
             <p className="text-[10px] font-bold text-[#0A2540] uppercase tracking-wider mb-2">Graph Legend</p>
             <div className="space-y-2">
               <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#df1b41]"></div><span className="text-[11px] text-[#425466]">High Risk</span></div>
               <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]"></div><span className="text-[11px] text-[#425466]">Elevated</span></div>
               <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#0CBF4C]"></div><span className="text-[11px] text-[#425466]">Low Risk</span></div>
               <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#e3e8ee]"><div className="w-3 h-0.5 bg-[#df1b41]"></div><span className="text-[11px] text-[#425466]">Flagged Edge</span></div>
             </div>
          </div>
        </div>

        {/* ── Side Inspector Panel ── */}
        <div className="space-y-6">
          
          {/* Node Identity Card */}
          <div className="bg-white border border-[#e3e8ee] rounded shadow-[0_2px_5px_rgba(0,0,0,0.02)] p-5">
            <h3 className="text-[11px] font-bold text-[#6B7C93] uppercase tracking-widest mb-4 border-b border-[#e3e8ee] pb-2">
              Entity Inspector
            </h3>
            
            {selectedNode ? (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div>
                  <p className="text-[10px] text-[#6B7C93] font-bold uppercase tracking-wider">UUID Identity</p>
                  <p className="text-[14px] font-mono font-medium text-[#0A2540] break-all bg-[#f6f9fc] p-2 rounded border border-[#e3e8ee] mt-1">
                    {selectedNode.id}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#f6f9fc] rounded border border-[#e3e8ee] p-3">
                    <p className="text-[10px] text-[#6B7C93] font-bold uppercase tracking-wider">Risk Score</p>
                    <p className={`text-xl font-light mt-1 ${selectedNode.risk_score >= 0.7 ? 'text-[#df1b41]' : selectedNode.risk_score >= 0.4 ? 'text-[#f59e0b]' : 'text-[#0CBF4C]'}`}>
                      {(selectedNode.risk_score * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-[#f6f9fc] rounded border border-[#e3e8ee] p-3">
                    <p className="text-[10px] text-[#6B7C93] font-bold uppercase tracking-wider">Transactions</p>
                    <p className="text-xl font-light text-[#0A2540] mt-1">{selectedNode.tx_count}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-[#f6f9fc] border border-[#e3e8ee] rounded p-3">
                    <p className="text-[11px] text-[#6B7C93] font-medium">Total Outflow</p>
                    <p className="text-[13px] font-medium text-[#0A2540]">₹{selectedNode.total_out.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="flex justify-between items-center bg-[#f6f9fc] border border-[#e3e8ee] rounded p-3">
                    <p className="text-[11px] text-[#6B7C93] font-medium">Total Inflow</p>
                    <p className="text-[13px] font-medium text-[#0A2540]">₹{selectedNode.total_in.toLocaleString('en-IN')}</p>
                  </div>
                </div>

                {selectedNode.is_flagged && (
                  <div className="bg-[#fff5f5] border border-[#ffcdcd] rounded p-3 flex items-start gap-2">
                    <span className="material-symbols-outlined text-[16px] text-[#df1b41]">security</span>
                    <div>
                      <p className="text-[11px] font-bold text-[#df1b41] uppercase tracking-wider">Security Flags Present</p>
                      <p className="text-[12px] text-[#df1b41] mt-0.5">{selectedNode.flagged} flagged interactions recorded</p>
                    </div>
                  </div>
                )}

                {/* Connected Peers list visually integrated */}
                {connectedPeers.length > 0 && (
                  <div className="border border-[#e3e8ee] rounded overflow-hidden">
                    <div className="bg-[#f6f9fc] p-2 border-b border-[#e3e8ee]">
                      <p className="text-[10px] text-[#6B7C93] font-bold uppercase tracking-wider pl-1">Direct Counterparties ({connectedPeers.length})</p>
                    </div>
                    <div className="bg-white max-h-[140px] overflow-y-auto space-y-0.5 p-1">
                      {connectedPeers.slice(0, 20).map((p, i) => (
                        <div key={i} className="flex flex-col p-1.5 hover:bg-[#f6f9fc] rounded transition-colors" title={p.id}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 min-w-0">
                               <span className={`material-symbols-outlined text-[14px] ${p.isOutbound ? 'text-[#df1b41]' : 'text-[#0CBF4C]'}`}>
                                 {p.isOutbound ? 'arrow_outward' : 'arrow_insert'}
                               </span>
                               <span className="text-[11px] font-mono text-[#0A2540] truncate w-[100px]">{p.id.substring(0, 10)}...</span>
                            </div>
                            <span className="text-[12px] font-medium text-[#425466]">₹{p.amount.toLocaleString('en-IN')}</span>
                          </div>
                          {p.is_flagged && <div className="text-[9px] font-bold uppercase text-[#df1b41] mt-0.5 ml-5">Flagged Path</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-[250px] flex flex-col items-center justify-center text-center px-4 bg-[#f6f9fc] border border-dashed border-[#e3e8ee] rounded">
                <span className="material-symbols-outlined text-3xl text-[#6B7C93] mb-2 font-light">touch_app</span>
                <p className="text-[12px] text-[#6B7C93] font-medium">Select a node from the topology to inspect metadata.</p>
              </div>
            )}
          </div>

          {/* Clusters Detected */}
          <div className="bg-white border border-[#e3e8ee] rounded shadow-[0_2px_5px_rgba(0,0,0,0.02)] p-5">
            <h3 className="text-[11px] font-bold text-[#6B7C93] uppercase tracking-widest mb-4 border-b border-[#e3e8ee] pb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">supervised_user_circle</span>
              High-Risk Clusters
            </h3>
            
            {clusters.length === 0 ? (
               <p className="text-[12px] text-[#6B7C93] font-medium py-4 text-center">No circular or cartel structures detected.</p>
            ) : (
              <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                {clusters.map((c, i) => (
                  <div key={i} className="border border-[#e3e8ee] rounded p-3 bg-[#f6f9fc] hover:bg-white transition-colors cursor-pointer group">
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-[11px] font-bold text-[#0A2540]">Cluster #{i+1}</span>
                       <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${c.threat_level === 'CRITICAL' ? 'bg-[#df1b41] text-white' : 'bg-[#f59e0b] text-white'}`}>
                          {c.threat_level}
                       </span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                       <p className="text-[11px] text-[#6B7C93]"><span className="font-medium text-[#0A2540]">{c.size}</span> Participants</p>
                       <p className="text-[11px] text-[#6B7C93]">Max Risk: <span className="font-medium text-[#0A2540]">{(c.max_risk * 100).toFixed(0)}%</span></p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
