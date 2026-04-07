import React from 'react';

export default function FraudHeuristics() {
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000 ease-out">
      <header className="space-y-4">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[0.95]">
          Fraud <span className="text-red-500">Heuristics</span>.
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed max-w-2xl">
          The SentinelClear Fraud Engine is a high-speed pre-commit verification layer. It evaluates risk signals *before* any database locks are acquired, ensuring high throughput and resilience.
        </p>
      </header>

      <hr className="border-zinc-100 dark:border-white/5" />

      {/* The 6 Signals Section */}
      <section className="space-y-6">
        <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white underline decoration-red-600/30 underline-offset-8">Core Risk Signals</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          <div className="p-6 bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 rounded-[32px] space-y-4">
            <span className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center font-black text-xs tracking-widest border border-red-500/20">01</span>
            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-tight">Velocity Barrier</h4>
            <p className="text-xs text-zinc-500 font-medium leading-relaxed">
              Calculates transactions per minute (TPM). <br />
              <code className="text-red-500 font-black">IF (TX_COUNT(10min) &gt; MAX_TPM): LOCK_ACCOUNT();</code>
            </p>
          </div>

          <div className="p-6 bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 rounded-[32px] space-y-4">
            <span className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center font-black text-xs tracking-widest border border-red-500/20">02</span>
            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-tight">Volume Outflow</h4>
            <p className="text-xs text-zinc-500 font-medium leading-relaxed">
               Monitors rolling 24h aggregate limits. <br />
               <code className="text-red-500 font-black">IF (Σ(TX_AMOUNT(24h)) &gt; DAILY_LIMIT): FLAG_REVIEW();</code>
            </p>
          </div>

          <div className="p-6 bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 rounded-[32px] space-y-4">
            <span className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center font-black text-xs tracking-widest border border-red-500/20">03</span>
            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-tight">Amount Threshold</h4>
            <p className="text-xs text-zinc-500 font-medium leading-relaxed">
               Immediate flagging of outsized transfers. <br />
               <code className="text-red-500 font-black">IF (TX_AMOUNT &gt; MAX_SINGLE_TX): BLOCK_FOR_ID_VER();</code>
            </p>
          </div>

          <div className="p-6 bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 rounded-[32px] space-y-4">
            <span className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center font-black text-xs tracking-widest border border-red-500/20">04</span>
            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-tight">New Account Trap</h4>
            <p className="text-xs text-zinc-500 font-medium leading-relaxed">
               <code className="text-red-500 font-black">IF (AGE &lt; 48h AND TX &gt; 10): INITIATE_COOLDOWN();</code>
            </p>
          </div>

          <div className="p-6 bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 rounded-[32px] space-y-4">
            <span className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center font-black text-xs tracking-widest border border-red-500/20">05</span>
            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-tight">Time Anomalies</h4>
            <p className="text-xs text-zinc-500 font-medium leading-relaxed">
               Behavioral shifts in transaction timestamps. <br />
               <code className="text-red-500 font-black">IF (TX_HOUR IN NO_TX_ZONE): RISK_SCORE + 40;</code>
            </p>
          </div>

          <div className="p-6 bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 rounded-[32px] space-y-4">
            <span className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center font-black text-xs tracking-widest border border-red-500/20">06</span>
            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-tight">Recipient Structuring</h4>
            <p className="text-xs text-zinc-500 font-medium leading-relaxed">
               Detection of money-muling patterns. <br />
               <code className="text-red-500 font-black">IF (Σ(UNIQUE_RX) &gt; 5 PER MIN): FLAG_STRUCTURING();</code>
            </p>
          </div>
        </div>
      </section>

      {/* Numerical Weighting Models */}
      <section className="space-y-8 p-10 bg-red-900/5 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-[40px] relative overflow-hidden group">
         <span className="material-symbols-outlined absolute top-10 right-10 text-9xl text-red-500/10 -rotate-12 transition-transform group-hover:rotate-0 duration-1000">gpp_maybe</span>
         <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Mathematical Weighting</h3>
         <p className="text-sm text-zinc-500 font-medium max-w-lg mb-8 leading-relaxed">
            Risk is calculated as a combined 0-1 confidence vector. If the score exceeds <span className="font-bold text-red-500 dark:text-red-400">0.75</span>, the transaction is instantly rejected.
         </p>
         
         <div className="p-6 bg-zinc-900 dark:bg-black border border-white/10 rounded-2xl">
            <pre className="text-xs font-mono text-zinc-400 dark:text-zinc-500 leading-relaxed overflow-x-auto italic">
{`# Scoring Logic Example
risk_vector = {
    "velocity": 0.40,
    "volume_24h": 0.25,
    "time_anomaly": 0.15,
    "account_depth": 0.20
}

# Calculated Score
total_risk = Σ(signal_i * probability_i)

if total_risk > THRESHOLD:
    publish_event("FRAUD_ALERT_EMITTED")
    raise SecurityException("Transaction Blocked")`}
            </pre>
         </div>
      </section>

      {/* Rule Notice */}
      <div className="p-8 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-3xl flex gap-8 items-center border border-white/10 group">
         <div className="space-y-2 flex-1">
            <h4 className="font-black text-[12px] uppercase tracking-[0.4em] mb-2 opacity-60">System Security Rule</h4>
            <p className="text-2xl font-black leading-tight tracking-tight">
               "Never Log PII in Fraud Signals. Hash the Recipient ID Before Analysis."
            </p>
         </div>
         <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shrink-0 shadow-2xl shadow-red-500/40 opacity-0 group-hover:opacity-100 transition-all group-hover:rotate-12">
            <span className="material-symbols-outlined text-white text-3xl">privacy_tip</span>
         </div>
      </div>
    </div>
  );
}
