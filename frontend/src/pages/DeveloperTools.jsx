import React, { useState } from 'react';
import axios from '../lib/axios';

export function DeveloperTools() {
  const [apiKey, setApiKey] = useState(null);
  const [targetUrl, setTargetUrl] = useState('');
  const [webhookSaved, setWebhookSaved] = useState(false);

  const handleGenerateKey = async () => {
    try {
      const response = await axios.post('/api/auth/api-keys');
      setApiKey(response.data);
    } catch (error) {
      console.error('Failed to generate API Key', error);
    }
  };

  const handleSaveWebhook = async () => {
    try {
      await axios.post('/api/auth/webhooks', { target_url: targetUrl });
      setWebhookSaved(true);
      setTimeout(() => setWebhookSaved(false), 3000);
      setTargetUrl('');
    } catch (error) {
      console.error('Failed to save Webhook', error);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-12">
      <header>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
          Developer Platform
        </h1>
        <p className="text-zinc-500 mt-2 font-medium">Provision API Keys and manage Webhook endpoints for BaaS integration.</p>
      </header>

      <section className="bg-white dark:bg-black/20 border border-zinc-200 dark:border-white/5 rounded-3xl p-8">
        <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-bold dark:text-white">API Keys</h2>
              <p className="text-sm text-zinc-500">Authenticate requests natively from external services.</p>
            </div>
            <button
              onClick={handleGenerateKey}
              className="px-6 py-2 bg-indigo-600 dark:bg-white text-white dark:text-black rounded-lg font-bold text-sm tracking-wide hover:scale-105 transition-all shadow-lg"
            >
              Generate New Key
            </button>
        </div>

        {apiKey && (
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-6 rounded-xl flex flex-col gap-3">
             <div className="flex items-center gap-2 text-amber-700 dark:text-amber-500 font-bold">
               <span className="material-symbols-outlined text-[18px]">warning</span>
               Store this key immediately. You will not be able to see it again!
             </div>
             <code className="block w-full p-4 bg-white dark:bg-black/50 border border-amber-200 dark:border-amber-500/20 rounded-lg text-emerald-600 font-mono text-sm break-all font-bold select-all">
                {apiKey.raw_key}
             </code>
          </div>
        )}
      </section>

      <section className="bg-white dark:bg-black/20 border border-zinc-200 dark:border-white/5 rounded-3xl p-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold dark:text-white">Webhook Endpoints</h2>
          <p className="text-sm text-zinc-500">Receive asynchronous event payloads when transfers successfully clear the double-entry ledger.</p>
        </div>

        <div className="flex flex-col gap-4">
           <input
             type="url"
             value={targetUrl}
             onChange={(e) => setTargetUrl(e.target.value)}
             placeholder="https://your-service.com/webhook"
             className="w-full px-4 py-3 bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl focus:border-indigo-500 outline-none transition-colors dark:text-white font-mono text-sm"
           />
           <button
             onClick={handleSaveWebhook}
             disabled={!targetUrl}
             className="w-full md:w-auto px-6 py-3 bg-zinc-900 dark:bg-zinc-800 text-white rounded-xl font-bold text-sm hover:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
           >
             {webhookSaved ? "Saved Successfully!" : "Register Webhook"}
           </button>
        </div>
      </section>
    </div>
  );
}
