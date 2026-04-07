import React, { useState } from 'react';
import apiClient from '../lib/axios';
import { toast } from 'sonner';

export function DevTools() {
  const [method, setMethod] = useState('POST');
  const [endpoint, setEndpoint] = useState('/api/accounts/me/deposit');
  const [payload, setPayload] = useState('{\n  "amount": 50000\n}');
  const [response, setResponse] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSendRequest = async () => {
    setLoading(true);
    setResponse(null);
    setStatus(null);
    
    try {
      // Normalize endpoint to handle both with and without leading '/api'
      const cleanEndpoint = endpoint.startsWith('/api') ? endpoint.substring(4) : endpoint;
      
      let res;
      if (method === 'GET') {
        res = await apiClient.get(cleanEndpoint);
      } else {
        const body = JSON.parse(payload);
        res = await apiClient.post(cleanEndpoint, body);
      }
      
      setResponse(JSON.stringify(res.data, null, 2));
      setStatus(`${res.status} OK`);
      toast.success('Request completed successfully');
    } catch (err) {
      console.error("API_PLAYGROUND_ERROR:", err);
      const errorMsg = err.response?.data?.detail || err.message || 'Unknown network error';
      setResponse(JSON.stringify(err.response?.data || { error: errorMsg }, null, 2));
      setStatus(err.response?.status ? `${err.response.status} ${err.response.statusText}` : 'ERROR');
      toast.error('API Request failed');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-4">
          Developer Tools
          <span className="text-[10px] uppercase tracking-widest text-indigo-600 dark:text-indigo-400 font-bold px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 translate-y-[-2px]">Internal Access</span>
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-lg">
          Raw API payload inspection, web-socket debugging, and network latency analytics.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* API Playground */}
        <div className="lg:col-span-8 bg-white dark:bg-[#080808] border border-zinc-200 dark:border-white/5 rounded-2xl flex flex-col h-[520px] shadow-sm dark:shadow-none overflow-hidden">
          <div className="p-4 border-b border-zinc-200 dark:border-white/5 flex gap-4 bg-zinc-50 dark:bg-transparent">
            <select 
              value={method}
              onChange={e => setMethod(e.target.value)}
              className="bg-zinc-200 dark:bg-zinc-900 border border-transparent dark:border-white/5 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white font-mono font-bold uppercase focus:outline-none"
            >
              <option>GET</option>
              <option>POST</option>
            </select>
            <input 
              type="text" 
              value={endpoint}
              onChange={e => setEndpoint(e.target.value)}
              className="flex-1 bg-white dark:bg-black border border-zinc-300 dark:border-white/10 rounded-lg px-4 py-2 text-sm text-zinc-900 dark:text-white font-mono placeholder:text-zinc-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
            <button 
              onClick={handleSendRequest}
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Request'}
            </button>
          </div>
          
          <div className="flex-1 grid grid-cols-2 divide-x divide-zinc-200 dark:divide-white/5 bg-zinc-100 dark:bg-black">
            <div className="p-4 flex flex-col">
              <span className="text-[10px] text-zinc-500 dark:text-zinc-500 uppercase tracking-widest font-bold mb-3">Request Payload (JSON)</span>
              <textarea 
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                readOnly={method === 'GET'}
                className={`flex-1 bg-white dark:bg-[#121315] border border-zinc-200 dark:border-white/5 rounded-xl p-4 focus:outline-none text-xs text-zinc-700 dark:text-zinc-300 font-mono resize-none shadow-inner dark:shadow-none ${method === 'GET' ? 'opacity-50 cursor-not-allowed' : ''}`}
                placeholder="{ \n  // JSON body \n}"
              ></textarea>
            </div>
            <div className="p-4 flex flex-col">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] text-zinc-500 dark:text-zinc-500 uppercase tracking-widest font-bold">Response Body</span>
                {status && (
                  <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${status.includes('200') || status.includes('201') ? 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-500' : 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-500'}`}>
                    {status}
                  </span>
                )}
              </div>
              <div className="flex-1 bg-white dark:bg-[#121315] border border-zinc-200 dark:border-white/5 rounded-xl p-4 text-xs text-zinc-800 dark:text-zinc-200 font-mono overflow-auto shadow-inner dark:shadow-none">
                {response ? <pre>{response}</pre> : <div className="h-full flex items-center justify-center text-zinc-400 italic">Awaiting systemic response...</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Latency Stats */}
        <div className="lg:col-span-4 bg-white dark:bg-[#080808] border border-zinc-200 dark:border-white/5 rounded-2xl p-6 shadow-sm dark:shadow-none flex flex-col justify-between">
          <div>
            <div className="border-b border-zinc-100 dark:border-white/5 pb-4 mb-6">
               <h3 className="text-[11px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400 font-bold">Network Latency (Internal proxy)</h3>
            </div>
            
            <div className="space-y-8">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">P99 Gateway Latency</span>
                  <span className="text-sm font-mono font-bold text-zinc-900 dark:text-white">42ms</span>
                </div>
                <div className="w-full h-2 bg-zinc-100 dark:bg-white/5 rounded-full overflow-hidden">
                  <div className="w-[45%] h-full bg-indigo-500 rounded-full"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Endpoint Error Rate</span>
                  <span className="text-sm font-mono font-bold text-red-600 dark:text-red-400">0.01%</span>
                </div>
                <div className="w-full h-2 bg-zinc-100 dark:bg-white/5 rounded-full overflow-hidden">
                  <div className="w-[2%] h-full bg-red-500 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-zinc-100 dark:border-white/5 mt-8">
             <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold leading-relaxed">
               All dev-tools payloads are routed through the secure internal proxy to <code className="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-1 py-0.5 rounded">localhost:8000</code>.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}
