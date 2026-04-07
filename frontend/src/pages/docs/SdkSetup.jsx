import React from 'react';

export default function SdkSetup() {
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000 ease-out">
      <header className="space-y-4">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[0.95]">
          SDK <span className="text-indigo-600">Setup</span>.
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed max-w-2xl">
          Integrating SentinelClear into your client application requires a secure, asynchronous connection handled via our specialized ledger-aware SDK.
        </p>
      </header>

      <hr className="border-zinc-100 dark:border-white/5" />

      {/* Installation */}
      <section className="space-y-6">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">Installation</h2>
        <p className="text-sm text-zinc-500 font-medium">Add the core library to your project environment:</p>
        <div className="p-4 bg-zinc-900 rounded-2xl font-mono text-xs text-zinc-300 relative">
           <span className="text-indigo-400">$</span> npm install @sentinel/clear-sdk
           <span className="absolute top-4 right-4 text-[10px] text-zinc-600 uppercase font-bold tracking-widest">v3.0.8</span>
        </div>
      </section>

      {/* Initialization Logic */}
      <section className="space-y-8">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Client Bootstrapping</h3>
        <p className="text-sm text-zinc-500 font-medium">To initialize the client, you must provide your unique API credentials and a valid endpoint. The SDK uses a built-in JWT rotation mechanism for enhanced security.</p>
        
        <div className="p-6 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-3xl space-y-4">
           <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-2 px-1">Example: client_init.js</p>
           <pre className="text-xs font-mono text-indigo-600 dark:text-indigo-400 overflow-x-auto leading-relaxed">
{`import { SentinelClient } from '@sentinel/clear-sdk';

const client = new SentinelClient({
  apiUrl: 'https://api.sentinelclear.io/v3',
  apiKey: process.env.SENTINEL_API_KEY,
  debug: false
});

// Initialization with JWT handshake
await client.initialize();

console.log("Vault Status: Active");`}
           </pre>
        </div>
      </section>

      {/* JWT Rotation Detail */}
      <section className="space-y-8 p-10 bg-indigo-600/[0.03] border border-indigo-600/10 rounded-3xl">
         <div className="flex items-center gap-4 mb-4">
            <span className="material-symbols-outlined text-indigo-600">key</span>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">JWT Lifecycle Management</h3>
         </div>
         <p className="text-sm text-zinc-500 leading-relaxed font-medium">
            SentinelClear employs a dual-token approach. A short-lived <code className="text-indigo-600 dark:text-indigo-400 font-bold px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-500/5 rounded">Access_Token</code> (expires in 15m) and a long-lived <code className="text-indigo-600 dark:text-indigo-400 font-bold px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-500/5 rounded">Refresh_Token</code>. The SDK automatically detects token expiration and performs a silent refresh transparently behind all ledger request operations.
         </p>
      </section>

      {/* Important Tip */}
      <div className="p-8 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-3xl">
         <h4 className="font-black text-sm uppercase tracking-[0.3em] mb-4 opacity-70">Implementation Rule #12</h4>
         <p className="text-lg font-bold leading-tight">
            "Never store API keys on client-side environments without an intermediate encryption layer. SentinelClear proxies should be used for production web clients."
         </p>
      </div>

    </div>
  );
}
