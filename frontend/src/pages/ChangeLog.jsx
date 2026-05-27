import React, { useState, useEffect } from 'react';

export function ChangeLog() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('sc_admin_changelog') || '[]');
      setLogs(stored);
    } catch {
      setLogs([]);
    }
  }, []);

  const filtered = logs.filter(l =>
    !search ||
    l.rule?.toLowerCase().includes(search.toLowerCase()) ||
    l.admin?.toLowerCase().includes(search.toLowerCase()) ||
    l.field?.toLowerCase().includes(search.toLowerCase())
  );

  const formatTime = (iso) => {
    try {
      return new Date(iso).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    } catch { return iso; }
  };

  const exportCSV = () => {
    const headers = 'Timestamp,Admin,Parameter,Field,Old Value,New Value';
    const rows = logs.map(l =>
      `"${l.timestamp}","${l.admin}","${l.rule}","${l.field}","${l.old_value}","${l.new_value}"`
    );
    const blob = new Blob([[headers, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentinel_changelog_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearLog = () => {
    if (!window.confirm('Clear all change log entries? This cannot be undone.')) return;
    localStorage.removeItem('sc_admin_changelog');
    setLogs([]);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 fade-in duration-500 pb-20 px-4 md:px-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] md:text-[40px] font-light tracking-tight text-[#0A2540] m-0">
            Change Log
          </h1>
          <p className="text-[14px] text-[#425466] mt-2 max-w-lg leading-[1.6]">
            Audit trail of all threshold and parameter adjustments. Stored locally per session.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {logs.length > 0 && (
            <>
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#e3e8ee] hover:bg-[#f6f9fc] text-[#0A2540] font-medium rounded text-[13px] transition-all min-h-[44px]"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Export CSV
              </button>
              <button
                onClick={clearLog}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#ffcdcd] hover:bg-[#fff5f5] text-[#df1b41] font-medium rounded text-[13px] transition-all min-h-[44px]"
              >
                <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7C93] text-[18px]">search</span>
        <input
          type="text"
          placeholder="Filter by parameter, admin, or field..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-white border border-[#e3e8ee] rounded-[8px] pl-10 pr-4 py-3 text-[14px] outline-none focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/20 transition-all text-[#0A2540]"
        />
      </div>

      {/* Log Table */}
      <div className="bg-white border border-[#e3e8ee] rounded-[12px] shadow-[0_2px_5px_rgba(0,0,0,0.02)] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-14 h-14 bg-[#f6f9fc] border border-[#e3e8ee] rounded-[12px] flex items-center justify-center">
              <span className="material-symbols-outlined text-[28px] text-[#6B7C93]">history</span>
            </div>
            <div>
              <p className="text-[15px] font-medium text-[#0A2540]">No changes recorded yet</p>
              <p className="text-[13px] text-[#6B7C93] mt-1">
                {logs.length > 0
                  ? 'No entries match your filter.'
                  : 'Parameter updates will appear here after you deploy from the Operations Hub.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#f6f9fc] border-b border-[#e3e8ee]">
                    {['Timestamp', 'Admin', 'Parameter', 'Field', 'Old Value', 'New Value'].map(h => (
                      <th key={h} className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[#6B7C93]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((log, i) => (
                    <tr key={log.id || i} className="border-b border-[#e3e8ee] hover:bg-[#f6f9fc] transition-colors">
                      <td className="px-5 py-3.5 text-[12px] font-mono text-[#6B7C93] whitespace-nowrap">{formatTime(log.timestamp)}</td>
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-[#635BFF]/10 flex items-center justify-center text-[10px] font-bold text-[#635BFF] shrink-0">
                            {(log.admin || 'A')[0].toUpperCase()}
                          </span>
                          <span className="text-[13px] font-medium text-[#0A2540]">{log.admin}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[12px] font-mono font-medium text-[#0A2540] bg-[#f6f9fc] border border-[#e3e8ee] px-2 py-0.5 rounded">
                          {log.rule?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[13px] text-[#425466] capitalize">{log.field?.replace(/_/g, ' ')}</td>
                      <td className="px-5 py-3.5">
                        <span className="text-[12px] font-mono text-[#df1b41] bg-[#fff5f5] px-2 py-0.5 rounded">{log.old_value}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[12px] font-mono text-[#0CBF4C] bg-[#e7f9ed] px-2 py-0.5 rounded">{log.new_value}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-[#e3e8ee]">
              {filtered.map((log, i) => (
                <div key={log.id || i} className="p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-[12px] font-mono font-medium text-[#0A2540] bg-[#f6f9fc] border border-[#e3e8ee] px-2 py-0.5 rounded">
                      {log.rule?.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[11px] font-mono text-[#6B7C93]">{formatTime(log.timestamp)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[12px] text-[#425466]">
                    <span className="font-medium text-[#0A2540]">{log.admin}</span>
                    <span>·</span>
                    <span className="capitalize">{log.field?.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[12px] font-mono">
                    <span className="text-[#df1b41] bg-[#fff5f5] px-2 py-0.5 rounded">{log.old_value}</span>
                    <span className="material-symbols-outlined text-[14px] text-[#6B7C93]">arrow_forward</span>
                    <span className="text-[#0CBF4C] bg-[#e7f9ed] px-2 py-0.5 rounded">{log.new_value}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-[#e3e8ee] bg-[#f6f9fc]">
              <p className="text-[12px] text-[#6B7C93] text-center">
                {filtered.length} of {logs.length} entries · Stored locally in this browser session
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
