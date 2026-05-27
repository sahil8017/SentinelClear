// HMR Trigger
import React from 'react';
import { Link } from 'react-router-dom';
import { isAuthenticated, getRoleFromToken } from '../lib/auth';

export function Home() {
  return (
    <div className="min-h-screen w-full flex flex-col bg-white text-[#425466] overflow-x-hidden font-body">
      
      {/* Navigation */}
      <nav className="w-full flex items-center justify-between px-6 md:px-10 py-5 border-b border-[#e3e8ee] bg-white/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#635BFF] rounded flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-[16px]">security</span>
          </div>
          <span className="font-semibold text-[#0A2540] tracking-tight text-[17px]">SentinelClear</span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 text-[14px] font-medium text-[#425466]">
          <Link to={isAuthenticated() ? "/dashboard" : "/login"} className="hover:text-[#635BFF] transition-colors">Platform</Link>
          <a href="#features" className="hover:text-[#635BFF] transition-colors">Capabilities</a>
          <a href="#how-it-works" className="hover:text-[#635BFF] transition-colors">Infrastructure</a>
        </div>
        
        <div className="flex items-center gap-4">
          <Link to={isAuthenticated() ? "/dashboard" : "/login"} className="px-4 py-2 bg-[#635BFF] text-white font-medium rounded text-[14px] transition-all hover:bg-[#5851db] shadow-[0_2px_5px_rgba(99,91,255,0.3)] active:scale-95">
            {isAuthenticated() ? "Dashboard" : "Sign In"}
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex flex-col items-center justify-center text-center px-4 pt-20 pb-32 md:pt-32 md:pb-40 relative">
        {/* Stripe Diagonal Mesh Gradient Approximation */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 bg-[#f6f9fc]">
           <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#635BFF]/10 blur-[120px] rounded-full"></div>
           <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-[#80e9ff]/20 blur-[140px] rounded-full"></div>
        </div>
        
        <div className="inline-flex items-center gap-2 mb-8 md:mb-10 px-3 py-1 bg-white border border-[#e3e8ee] rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.04)] animate-in fade-in slide-in-from-bottom-4 duration-700">
           <span className="w-1.5 h-1.5 rounded-full bg-[#0CBF4C]"></span>
           <span className="text-[11px] uppercase font-bold tracking-wider text-[#0A2540]">Enterprise-Grade Core Banking API</span>
        </div>

        <h1 className="text-[48px] md:text-[80px] font-light tracking-tight mb-6 md:mb-10 max-w-5xl leading-[1.1] text-[#0A2540] animate-in fade-in slide-in-from-bottom-6 duration-1000">
          Core banking infrastructure <br className="hidden md:block"/>
          <span className="text-[#635BFF]">engineered for reliability.</span>
        </h1>
        
        <p className="text-[17px] md:text-[21px] text-[#425466] max-w-3xl mx-auto mb-10 md:mb-14 font-medium leading-[1.6] animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100 px-4">
          A high-performance transaction system featuring real-time risk scoring, idempotent request guarantees, double-entry ledger auditing, and native UPI regulatory compliance.
        </p>

        <div className="flex justify-center animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-200 w-full sm:w-auto px-4">
          <Link to={isAuthenticated() ? "/dashboard" : "/login"} className="w-full sm:w-auto px-6 py-3.5 bg-[#0A2540] text-white font-medium rounded text-[15px] transition-all hover:bg-[#112F4E] shadow-[0_4px_10px_rgba(10,37,64,0.15)] flex items-center justify-center gap-2 group whitespace-nowrap">
            {isAuthenticated() ? (getRoleFromToken() === 'ADMIN' ? 'Start Operations' : 'Access Dashboard') : 'Access Dashboard'} 
            <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </Link>
        </div>
      </main>

      {/* Feature Grid */}
      <section id="features" className="w-full max-w-6xl mx-auto px-4 md:px-6 pb-32 md:pb-40">
        <div className="text-center mb-16">
          <span className="text-[12px] font-bold text-[#635BFF] uppercase tracking-wider mb-3 block">Platform Capabilities</span>
          <h2 className="text-[32px] md:text-[40px] font-light tracking-tight text-[#0A2540]">Built for zero-failure financial execution.</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           
           <div className="md:col-span-2 bg-white border border-[#e3e8ee] shadow-[0_2px_5px_rgba(0,0,0,0.02)] rounded-[12px] p-8 md:p-12 flex flex-col justify-between group overflow-hidden relative">
              <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 group-hover:opacity-10 transition-opacity">
                 <span className="material-symbols-outlined text-[200px] text-[#0A2540]">repeat</span>
              </div>
              <div className="relative z-10">
                <span className="material-symbols-outlined text-[#635BFF] text-3xl mb-5 block">verified_user</span>
                <h3 className="text-[24px] font-light tracking-tight mb-3 text-[#0A2540]">Idempotency & Safe Retries</h3>
                <p className="text-[16px] text-[#425466] font-medium leading-[1.6] max-w-md">
                   Enforces strict once-only execution rules at the database boundary to guarantee that network retries or accidental double-clicks never result in duplicate charges.
                </p>
              </div>
              <div className="mt-12 flex flex-wrap gap-3 relative z-10">
                 <div className="px-3 py-1 bg-[#f6f9fc] border border-[#e3e8ee] rounded text-[12px] font-medium text-[#425466]">Idempotent Key Verification</div>
                 <div className="px-3 py-1 bg-[#f6f9fc] border border-[#e3e8ee] rounded text-[12px] font-medium text-[#425466]">24H Distributed Cache</div>
                 <div className="px-3 py-1 bg-[#f6f9fc] border border-[#e3e8ee] rounded text-[12px] font-medium text-[#425466]">Optimistic Row Locking</div>
              </div>
           </div>

           <div className="bg-white border border-[#e3e8ee] shadow-[0_2px_5px_rgba(0,0,0,0.02)] rounded-[12px] p-8 flex flex-col justify-between hover:border-[#635BFF]/30 transition-colors">
              <div>
                <span className="material-symbols-outlined text-[#ff6118] text-3xl mb-5 block">security</span>
                <h3 className="text-[20px] font-light tracking-tight mb-3 text-[#0A2540]">Automated Risk Scoring</h3>
                <p className="text-[15px] text-[#425466] font-medium leading-[1.6]">
                   Evaluates transfer parameters and scores user velocity behavior against configurable system policies in under 50 milliseconds.
                </p>
              </div>
              <div className="w-full h-1 bg-[#f6f9fc] rounded-full overflow-hidden mt-10">
                 <div className="w-3/4 h-full bg-[#ff6118] animate-pulse"></div>
              </div>
           </div>

           <div className="bg-white border border-[#e3e8ee] shadow-[0_2px_5px_rgba(0,0,0,0.02)] rounded-[12px] p-8 flex flex-col justify-between hover:border-[#635BFF]/30 transition-colors">
              <div>
                <span className="material-symbols-outlined text-[#0CBF4C] text-3xl mb-5 block">history_edu</span>
                <h3 className="text-[20px] font-light tracking-tight mb-3 text-[#0A2540]">Immutable Audit Trails</h3>
                <p className="text-[15px] text-[#425466] font-medium leading-[1.6]">
                   Maintains a cryptographically linked journal of accounts and transactions, creating a verifiable and audit-ready system of record.
                </p>
              </div>
           </div>

           <div className="md:col-span-2 bg-white border border-[#e3e8ee] shadow-[0_2px_5px_rgba(0,0,0,0.02)] rounded-[12px] p-8 md:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-10 hover:border-[#635BFF]/30 transition-colors">
              <div className="max-w-md">
                 <span className="material-symbols-outlined text-[#df1b41] text-3xl mb-5 block">account_balance</span>
                 <h3 className="text-[24px] font-light tracking-tight mb-3 text-[#0A2540]">Double-Entry Ledger Core</h3>
                 <p className="text-[16px] text-[#425466] font-medium leading-[1.6]">
                   Ensures mathematical integrity at the database layer where assets are always balanced. Debits and credits match exactly, preventing orphaned transactions.
                 </p>
              </div>
              <div className="w-full flex-1 bg-[#f6f9fc] border border-[#e3e8ee] rounded p-5 font-mono text-[13px] text-[#0A2540] overflow-x-auto">
                 <p className="mb-2 text-[#6B7C93]">// Ledger consistency check</p>
                 <p>ASSERT balance_sum === 0.00;</p>
                 <p>ASSERT DR === CR;</p>
                 <p className="mt-4 text-[#0CBF4C] font-semibold">STATUS: VERIFIED_ATOMIC</p>
              </div>
           </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="w-full max-w-6xl mx-auto px-4 md:px-6 pb-32 md:pb-40">
        <div className="text-center mb-16">
          <span className="text-[12px] font-bold text-[#635BFF] uppercase tracking-wider mb-3 block">Transaction Processing</span>
          <h2 className="text-[32px] md:text-[40px] font-light tracking-tight text-[#0A2540]">The validation pipeline.</h2>
          <p className="text-[17px] text-[#6B7C93] mt-4 max-w-2xl mx-auto font-medium">Every balance transfer passes through automated verification steps to ensure compliance, authorization, and liquidity before it is committed.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[{
            step: '01', icon: 'fingerprint', color: '#635BFF',
            title: 'JWT Session Security',
            desc: 'Verifies asymmetric JWT signatures and validates current session permissions before accepting the payload.'
          }, {
            step: '02', icon: 'gavel', color: '#ff6118',
            title: 'Velocity & Limits',
            desc: 'Instantly runs checks against account balance caps, transaction limits, and verified contact lists.'
          }, {
            step: '03', icon: 'psychology', color: '#df1b41',
            title: 'Multi-Layer Risk Scoring',
            desc: 'Evaluates transaction characteristics against fraud rules to flag high-risk behaviors and anomalous patterns.'
          }, {
            step: '04', icon: 'check_circle', color: '#0CBF4C',
            title: 'Atomic Commit',
            desc: 'Executes the ledger transfer as a single database transaction block and signs the entry cryptographically.'
          }].map(item => (
            <div key={item.step} className="bg-white border border-[#e3e8ee] rounded-[12px] p-6 shadow-[0_2px_5px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all h-full flex flex-col group">
              <div className="flex items-center justify-between mb-6">
                <span className="text-[28px] font-light text-[#0A2540]">{item.step}</span>
                <span className="material-symbols-outlined text-[24px]" style={{color: item.color}}>{item.icon}</span>
              </div>
              <h4 className="text-[17px] font-semibold text-[#0A2540] mb-2">{item.title}</h4>
              <p className="text-[14px] text-[#425466] font-medium leading-[1.5]">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Live Metrics Strip */}
      <section className="w-full bg-[#0A2540] text-white py-20 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-6 text-center">
          {[
            { label: 'Active Fraud Checks', value: '13', sub: 'Across 3 layers' },
            { label: 'Latency Ceiling', value: '<50ms', sub: 'P99 execution time' },
            { label: 'Ledger Audit', value: '0.00', sub: 'Zero-sum integrity' },
            { label: 'Security Model', value: 'RS256', sub: 'Cryptographically signed' },
          ].map((stat, i) => (
            <div key={i} className="space-y-1">
              <p className="text-[40px] md:text-[48px] font-light tracking-tight">{stat.value}</p>
              <p className="text-[13px] font-bold uppercase tracking-wider text-[#80e9ff]">{stat.label}</p>
              <p className="text-[13px] text-[#87a5c4] font-medium">{stat.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="w-full max-w-4xl mx-auto px-4 md:px-6 py-24 md:py-32 text-center">
        <div className="bg-[#f6f9fc] border border-[#e3e8ee] rounded-[16px] p-10 md:p-20 shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
           <h2 className="text-[32px] md:text-[48px] font-light tracking-tight text-[#0A2540] mb-4">
             Secure your financial pipelines.
           </h2>
           <p className="text-[16px] md:text-[20px] text-[#425466] font-medium max-w-xl mx-auto mb-10 leading-[1.5]">
             Register a new developer profile, connect to our API gateway, and audit ledger health.
           </p>
           <div className="flex justify-center w-full sm:w-auto">
             <Link to={isAuthenticated() ? "/dashboard" : "/register"} className="w-full sm:w-auto px-8 py-3.5 bg-[#635BFF] text-white font-medium rounded text-[15px] transition-all hover:bg-[#5851db] shadow-[0_4px_10px_rgba(99,91,255,0.2)]">
               {isAuthenticated() ? "Go to Dashboard" : "Create account today"}
             </Link>
           </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full py-16 px-4 md:px-8 border-t border-[#e3e8ee] bg-[#f6f9fc]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
           <div className="md:col-span-2 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 flex items-center justify-center bg-[#635BFF] text-white rounded shadow-sm">
                   <span className="material-symbols-outlined text-[14px]">security</span>
                </div>
                <span className="font-semibold tracking-tight text-[15px] text-[#0A2540]">SentinelClear</span>
              </div>
              <p className="text-[14px] text-[#425466] font-medium max-w-xs leading-[1.6]">
                Modern financial infrastructure ensuring secure, idempotent, and auditable core banking operations.
              </p>
              <p className="text-[12px] text-[#6B7C93] pt-4 font-medium">© 2026 SentinelClear. All rights reserved.</p>
           </div>
           
           <div className="space-y-4">
              <h4 className="text-[12px] font-bold text-[#0A2540] uppercase tracking-wider">Product</h4>
              <ul className="space-y-3 text-[14px] font-medium text-[#425466]">
                <li><Link to={isAuthenticated() ? "/dashboard" : "/login"} className="hover:text-[#635BFF] transition-colors">{isAuthenticated() && getRoleFromToken() === 'ADMIN' ? 'Operations Hub' : 'User Platform'}</Link></li>
              </ul>
           </div>

        </div>
      </footer>
    </div>
  );
}

