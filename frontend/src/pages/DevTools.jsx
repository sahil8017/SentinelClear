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
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-8 fade-in duration-500 pb-20 px-4 md:px-0">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[32px] md:text-[40px] font-light tracking-tight text-[#0A2540] m-0">Developer Tools</h1>
          <span className="text-[10px] uppercase tracking-wider text-[#635BFF] font-bold px-2 py-1 rounded bg-[#f0eeff] border border-[#635BFF]/20">Internal</span>
        </div>
        <p className="text-[14px] text-[#425466] mt-2 max-w-lg leading-[1.6]">
          Raw API payload inspection, web-socket debugging, and network latency analytics.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        
        {/* API Playground */}
        <div className="lg:col-span-8 bg-white border border-[#e3e8ee] rounded-[16px] flex flex-col h-[520px] shadow-[0_2px_5px_rgba(0,0,0,0.02)] overflow-hidden">
          <div className="p-4 border-b border-[#e3e8ee] flex flex-wrap gap-3 bg-[#f6f9fc]">
            <select 
              value={method}
              onChange={e => setMethod(e.target.value)}
              className="bg-white border border-[#e3e8ee] rounded-[6px] px-3 py-2 text-[13px] text-[#0A2540] font-mono font-semibold uppercase focus:outline-none focus:border-[#635BFF]"
            >
              <option>GET</option>
              <option>POST</option>
            </select>
            <input 
              type="text" 
              value={endpoint}
              onChange={e => setEndpoint(e.target.value)}
              className="flex-1 min-w-0 bg-white border border-[#e3e8ee] rounded-[6px] px-4 py-2 text-[13px] text-[#0A2540] font-mono focus:outline-none focus:border-[#635BFF] transition-colors"
            />
            <button 
              onClick={handleSendRequest}
              disabled={loading}
              className="px-5 py-2 bg-[#635BFF] hover:bg-[#5851db] text-white font-medium rounded-[6px] text-[13px] transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send'}
            </button>
          </div>
          
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#e3e8ee] bg-[#f6f9fc]">
            <div className="p-4 flex flex-col">
              <span className="text-[11px] text-[#6B7C93] uppercase tracking-wider font-bold mb-3">Request Payload</span>
              <textarea 
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                readOnly={method === 'GET'}
                className={`flex-1 bg-white border border-[#e3e8ee] rounded-[8px] p-4 focus:outline-none text-[12px] text-[#0A2540] font-mono resize-none ${method === 'GET' ? 'opacity-50 cursor-not-allowed' : ''}`}
                placeholder="{ \n  // JSON body \n}"
              ></textarea>
            </div>
            <div className="p-4 flex flex-col">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[11px] text-[#6B7C93] uppercase tracking-wider font-bold">Response Body</span>
                {status && (
                  <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded ${status.includes('200') || status.includes('201') ? 'bg-[#e7f9ed] text-[#0CBF4C]' : 'bg-[#fff5f5] text-[#df1b41]'}`}>
                    {status}
                  </span>
                )}
              </div>
              <div className="flex-1 bg-white border border-[#e3e8ee] rounded-[8px] p-4 text-[12px] text-[#0A2540] font-mono overflow-auto">
                {response ? <pre className="whitespace-pre-wrap">{response}</pre> : <div className="h-full flex items-center justify-center text-[#6B7C93] text-[13px]">Awaiting response...</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Latency Stats */}
        <div className="lg:col-span-4 bg-white border border-[#e3e8ee] rounded-[16px] p-6 shadow-[0_2px_5px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <div className="border-b border-[#e3e8ee] pb-4 mb-6">
               <h3 className="text-[13px] font-medium text-[#0A2540]">Network Latency</h3>
            </div>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[13px] font-medium text-[#425466]">P99 Gateway Latency</span>
                  <span className="text-[13px] font-mono font-semibold text-[#0A2540]">42ms</span>
                </div>
                <div className="w-full h-2 bg-[#e3e8ee] rounded-full overflow-hidden">
                  <div className="w-[45%] h-full bg-[#635BFF] rounded-full"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[13px] font-medium text-[#425466]">Endpoint Error Rate</span>
                  <span className="text-[13px] font-mono font-semibold text-[#df1b41]">0.01%</span>
                </div>
                <div className="w-full h-2 bg-[#e3e8ee] rounded-full overflow-hidden">
                  <div className="w-[2%] h-full bg-[#df1b41] rounded-full"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-[#e3e8ee] mt-8">
             <p className="text-[11px] text-[#6B7C93] leading-relaxed">
               All payloads are routed through the secure internal proxy to <code className="text-[#635BFF] bg-[#f0eeff] px-1 py-0.5 rounded text-[10px]">localhost:8000</code>.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}
