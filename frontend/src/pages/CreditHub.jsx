import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../lib/axios';
import { useMinLoadingTime } from '../lib/useMinLoadingTime';
import { Skeleton } from '../components/ui/Skeleton';

/* ─── Credit Score Gauge (SVG Arc) ─── */
function CreditGauge({ score, rating }) {
  const min = 300, max = 900;
  const pct = Math.max(0, Math.min(1, (score - min) / (max - min)));
  const angle = pct * 180;
  const r = 90, cx = 110, cy = 105;
  const startAngle = Math.PI;
  const endAngle = Math.PI - (angle * Math.PI / 180);
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy - r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy - r * Math.sin(endAngle);
  const largeArc = angle > 180 ? 1 : 0;

  const color =
    score >= 750 ? '#10b981' :
    score >= 650 ? '#3b82f6' :
    score >= 550 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center">
      <svg width="220" height="130" viewBox="0 0 220 130">
        {/* Background arc */}
        <path d={`M 20 105 A 90 90 0 0 1 200 105`} fill="none" stroke="currentColor" className="text-zinc-200 dark:text-white/10" strokeWidth="14" strokeLinecap="round" />
        {/* Score arc */}
        {angle > 0 && (
          <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 0 ${x2} ${y2}`} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 8px ${color}40)` }} />
        )}
        {/* Score */}
        <text x="110" y="88" textAnchor="middle" className="fill-zinc-900 dark:fill-white" style={{ fontSize: '36px', fontWeight: 900 }}>{score}</text>
        <text x="110" y="115" textAnchor="middle" style={{ fontSize: '11px', fontWeight: 700, fill: color, letterSpacing: '2px' }}>{rating}</text>
        {/* Min / Max labels */}
        <text x="18" y="125" textAnchor="middle" className="fill-zinc-400" style={{ fontSize: '10px' }}>300</text>
        <text x="202" y="125" textAnchor="middle" className="fill-zinc-400" style={{ fontSize: '10px' }}>900</text>
      </svg>
    </div>
  );
}

/* ─── Impact Badge ─── */
function ImpactBadge({ impact }) {
  const styles = {
    POSITIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    NEGATIVE: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
    NEUTRAL: 'bg-zinc-100 text-zinc-600 dark:bg-white/5 dark:text-zinc-400',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${styles[impact] || styles.NEUTRAL}`}>
      {impact}
    </span>
  );
}

/* ─── Stat Card ─── */
function Stat({ label, value, sub }) {
  return (
    <div className="bg-zinc-50 dark:bg-white/[0.03] rounded-2xl p-4 border border-zinc-100 dark:border-white/5">
      <div className="text-[10px] uppercase font-black tracking-widest text-zinc-400 mb-1">{label}</div>
      <div className="text-lg font-black dark:text-white">{value}</div>
      {sub && <div className="text-[11px] text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export function CreditHub() {
  const [loans, setLoans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [tenure, setTenure] = useState('12');
  const [repayAmount, setRepayAmount] = useState('');
  const [selectedLoan, setSelectedLoan] = useState(null);

  /* Credit Profile */
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({
    monthly_income: '', existing_liabilities: '', total_assets: '',
    employment_type: 'salaried', employment_years: '', age: '',
    dependents: '0', residence_type: 'rented',
  });
  const [profileSubmitting, setProfileSubmitting] = useState(false);

  /* Assessment */
  const [assessment, setAssessment] = useState(null);
  const [assessLoading, setAssessLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('profile'); // profile | assess | loans

  const showSkeleton = useMinLoadingTime(isLoading, 1200);

  const fetchLoans = async () => {
    try {
      const { data } = await apiClient.get('/loans');
      setLoans(data);
    } catch (e) { console.error(e); }
  };

  const fetchProfile = async () => {
    try {
      const { data } = await apiClient.get('/loans/credit-profile');
      setProfile(data);
    } catch (e) {
      if (e.response?.status !== 404) console.error(e);
    }
  };

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([fetchLoans(), fetchProfile()]);
      setIsLoading(false);
    };
    init();
  }, []);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileSubmitting(true);
    try {
      const payload = {
        monthly_income: parseFloat(profileForm.monthly_income),
        existing_liabilities: parseFloat(profileForm.existing_liabilities) || 0,
        total_assets: parseFloat(profileForm.total_assets) || 0,
        employment_type: profileForm.employment_type,
        employment_years: parseFloat(profileForm.employment_years) || 0,
        age: parseInt(profileForm.age),
        dependents: parseInt(profileForm.dependents) || 0,
        residence_type: profileForm.residence_type,
      };
      await apiClient.post('/loans/credit-profile', payload);
      await fetchProfile();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to save profile');
    } finally {
      setProfileSubmitting(false);
    }
  };

  const handleCheckEligibility = async () => {
    setAssessLoading(true);
    try {
      const { data } = await apiClient.post('/loans/check-eligibility', {
        principal_amount: parseFloat(amount),
        duration_months: parseInt(tenure),
      });
      setAssessment(data);
    } catch (error) {
      alert(error.response?.data?.detail || 'Eligibility check failed');
    } finally {
      setAssessLoading(false);
    }
  };

  const handleApply = async () => {
    try {
      await apiClient.post('/loans/apply', {
        principal_amount: parseFloat(amount),
        duration_months: parseInt(tenure),
      });
      setAmount('');
      setAssessment(null);
      fetchLoans();
      setActiveTab('loans');
    } catch (error) {
      alert(error.response?.data?.detail || 'Loan application failed');
    }
  };

  const handlePayEmi = async (loanId) => {
    try {
      await apiClient.post(`/loans/${loanId}/repay`, { amount: parseFloat(repayAmount) });
      setRepayAmount('');
      setSelectedLoan(null);
      fetchLoans();
    } catch (error) {
      alert(error.response?.data?.detail || 'Repayment Failed');
    }
  };

  if (showSkeleton) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-12">
        <header>
          <Skeleton className="w-48 h-8 mb-2" />
          <Skeleton className="w-72 h-4" />
        </header>
        <div className="bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-[30px] p-8 space-y-6">
          <Skeleton className="w-56 h-6 mb-4" />
          <div className="grid grid-cols-2 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-xl"/>)}
          </div>
          <Skeleton className="h-[130px] w-[220px] mx-auto rounded-xl mt-6" />
        </div>
      </div>
    );
  }

  const tabs = [
    { key: 'profile', label: 'Credit Profile' },
    { key: 'assess', label: 'Loan Eligibility' },
    { key: 'loans', label: `My Loans${loans.length ? ` (${loans.length})` : ''}` },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-10">
      <header>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
          Credit Hub
        </h1>
        <p className="text-zinc-500 mt-2 font-medium">AI-Powered Credit Scoring & Lending Engine</p>
      </header>

      {/* Tab Nav */}
      <div className="flex gap-1 bg-zinc-100 dark:bg-white/5 p-1 rounded-2xl w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === t.key
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── TAB: Credit Profile ─── */}
      {activeTab === 'profile' && (
        <div className="space-y-8">
          {/* Credit Score Gauge (if profile exists) */}
          {profile && (
            <section className="bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-[30px] p-8">
              <div className="flex flex-col lg:flex-row items-center gap-8">
                <CreditGauge score={profile.credit_score} rating={
                  profile.credit_score >= 800 ? 'EXCELLENT' :
                  profile.credit_score >= 750 ? 'VERY GOOD' :
                  profile.credit_score >= 700 ? 'GOOD' :
                  profile.credit_score >= 650 ? 'FAIR' :
                  profile.credit_score >= 550 ? 'POOR' : 'VERY POOR'
                } />
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
                  <Stat label="Monthly Income" value={`₹${profile.monthly_income.toLocaleString()}`} />
                  <Stat label="FOIR" value={`${(profile.foir * 100).toFixed(1)}%`} sub={profile.foir > 0.5 ? 'Above RBI limit' : 'Within RBI norms'} />
                  <Stat label="Debt-to-Income" value={`${(profile.debt_to_income * 100).toFixed(1)}%`} />
                  <Stat label="Repayment Score" value={`${(profile.repayment_history_score * 100).toFixed(0)}%`} />
                  <Stat label="Account Age" value={`${profile.account_age_months} mo`} />
                  <Stat label="Previous Loans" value={profile.num_previous_loans} sub={profile.num_defaults > 0 ? `${profile.num_defaults} default(s)` : 'No defaults'} />
                </div>
              </div>
            </section>
          )}

          {/* Profile Form */}
          <section className="bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-[30px] p-8">
            <h2 className="text-xl font-bold dark:text-white mb-1">{profile ? 'Update' : 'Submit'} Financial Profile</h2>
            <p className="text-zinc-500 text-sm mb-6">Required for credit assessment as per KYC & RBI norms.</p>
            <form onSubmit={handleProfileSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-black tracking-widest text-zinc-400 mb-1.5">Monthly Income (₹) *</label>
                  <input type="number" required value={profileForm.monthly_income} onChange={e => setProfileForm(p => ({...p, monthly_income: e.target.value}))}
                    placeholder="55000" className="w-full px-4 py-3 bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl outline-none dark:text-white font-mono text-sm focus:border-indigo-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black tracking-widest text-zinc-400 mb-1.5">Existing EMIs/Debts (₹)</label>
                  <input type="number" value={profileForm.existing_liabilities} onChange={e => setProfileForm(p => ({...p, existing_liabilities: e.target.value}))}
                    placeholder="0" className="w-full px-4 py-3 bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl outline-none dark:text-white font-mono text-sm focus:border-indigo-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black tracking-widest text-zinc-400 mb-1.5">Total Assets (₹)</label>
                  <input type="number" value={profileForm.total_assets} onChange={e => setProfileForm(p => ({...p, total_assets: e.target.value}))}
                    placeholder="500000" className="w-full px-4 py-3 bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl outline-none dark:text-white font-mono text-sm focus:border-indigo-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black tracking-widest text-zinc-400 mb-1.5">Age *</label>
                  <input type="number" required min="18" max="80" value={profileForm.age} onChange={e => setProfileForm(p => ({...p, age: e.target.value}))}
                    placeholder="28" className="w-full px-4 py-3 bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl outline-none dark:text-white font-mono text-sm focus:border-indigo-500 transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-black tracking-widest text-zinc-400 mb-1.5">Employment Type</label>
                  <select value={profileForm.employment_type} onChange={e => setProfileForm(p => ({...p, employment_type: e.target.value}))}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl outline-none dark:text-white text-sm focus:border-indigo-500 transition-colors">
                    <option value="salaried">Salaried</option>
                    <option value="self_employed">Self-Employed</option>
                    <option value="freelancer">Freelancer</option>
                    <option value="unemployed">Unemployed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black tracking-widest text-zinc-400 mb-1.5">Employment Years</label>
                  <input type="number" step="0.5" value={profileForm.employment_years} onChange={e => setProfileForm(p => ({...p, employment_years: e.target.value}))}
                    placeholder="5" className="w-full px-4 py-3 bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl outline-none dark:text-white font-mono text-sm focus:border-indigo-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black tracking-widest text-zinc-400 mb-1.5">Dependents</label>
                  <input type="number" min="0" max="15" value={profileForm.dependents} onChange={e => setProfileForm(p => ({...p, dependents: e.target.value}))}
                    placeholder="0" className="w-full px-4 py-3 bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl outline-none dark:text-white font-mono text-sm focus:border-indigo-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black tracking-widest text-zinc-400 mb-1.5">Residence</label>
                  <select value={profileForm.residence_type} onChange={e => setProfileForm(p => ({...p, residence_type: e.target.value}))}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl outline-none dark:text-white text-sm focus:border-indigo-500 transition-colors">
                    <option value="rented">Rented</option>
                    <option value="owned">Owned</option>
                    <option value="parental">Parental</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={profileSubmitting || !profileForm.monthly_income || !profileForm.age}
                className="px-8 py-3 bg-indigo-600 dark:bg-white text-white dark:text-black font-black uppercase text-sm tracking-widest rounded-xl hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100">
                {profileSubmitting ? 'Saving...' : profile ? 'Update Profile' : 'Save Profile'}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* ─── TAB: Loan Eligibility ─── */}
      {activeTab === 'assess' && (
        <div className="space-y-8">
          {!profile ? (
            <div className="bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-[30px] p-10 text-center">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="text-lg font-bold dark:text-white mb-2">Profile Required</h3>
              <p className="text-zinc-500 text-sm mb-4">Complete your financial profile first to check loan eligibility.</p>
              <button onClick={() => setActiveTab('profile')} className="px-6 py-2.5 bg-indigo-600 dark:bg-white text-white dark:text-black font-bold text-sm rounded-xl hover:scale-105 transition-transform">
                Go to Profile
              </button>
            </div>
          ) : (
            <>
              {/* Current Score */}
              <section className="bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-[30px] p-8">
                <div className="flex items-center gap-6 mb-6">
                  <CreditGauge score={profile.credit_score} rating={
                    profile.credit_score >= 800 ? 'EXCELLENT' :
                    profile.credit_score >= 750 ? 'VERY GOOD' :
                    profile.credit_score >= 700 ? 'GOOD' :
                    profile.credit_score >= 650 ? 'FAIR' :
                    profile.credit_score >= 550 ? 'POOR' : 'VERY POOR'
                  } />
                  <div className="flex-1">
                    <h2 className="text-xl font-bold dark:text-white mb-4">Check Loan Eligibility</h2>
                    <div className="flex flex-wrap gap-3">
                      <div className="flex-1 min-w-[150px]">
                        <label className="block text-[10px] uppercase font-black tracking-widest text-zinc-400 mb-1.5">Loan Amount (₹)</label>
                        <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                          placeholder="100000" className="w-full px-4 py-3 bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl outline-none dark:text-white font-mono text-sm focus:border-indigo-500 transition-colors" />
                      </div>
                      <div className="w-[140px]">
                        <label className="block text-[10px] uppercase font-black tracking-widest text-zinc-400 mb-1.5">Tenure (Months)</label>
                        <select value={tenure} onChange={e => setTenure(e.target.value)}
                          className="w-full px-4 py-3 bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl outline-none dark:text-white text-sm focus:border-indigo-500 transition-colors">
                          {[6,12,18,24,36,48,60].map(m => <option key={m} value={m}>{m} months</option>)}
                        </select>
                      </div>
                      <div className="flex items-end">
                        <button onClick={handleCheckEligibility} disabled={!amount || assessLoading}
                          className="px-6 py-3 bg-indigo-600 dark:bg-white text-white dark:text-black font-black uppercase text-sm tracking-widest rounded-xl hover:scale-105 transition-transform disabled:opacity-50">
                          {assessLoading ? 'Analyzing...' : 'Check'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Assessment Results */}
              {assessment && (
                <section className="space-y-6">
                  {/* Verdict */}
                  <div className={`rounded-[30px] p-8 border ${
                    assessment.eligible
                      ? 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20'
                      : 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20'
                  }`}>
                    <div className="flex items-center gap-4 mb-6">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${
                        assessment.eligible ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-red-100 dark:bg-red-500/20'
                      }`}>
                        {assessment.eligible ? '✓' : '✗'}
                      </div>
                      <div>
                        <h3 className={`text-2xl font-black ${assessment.eligible ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                          {assessment.eligible ? 'Loan Eligible' : 'Not Eligible'}
                        </h3>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                          Risk Category: <span className="font-bold">{assessment.ml_risk_category}</span> | ML Confidence: <span className="font-mono">{(assessment.ml_eligibility_score * 100).toFixed(1)}%</span>
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Stat label="Credit Score" value={assessment.credit_score} sub={assessment.credit_rating} />
                      <Stat label="Max Eligible" value={`₹${assessment.max_eligible_amount.toLocaleString()}`} />
                      <Stat label="Interest Rate" value={`${assessment.recommended_interest_rate}%`} sub="Risk-adjusted" />
                      <Stat label="FOIR" value={`${(assessment.foir * 100).toFixed(1)}%`} sub={assessment.foir > 0.5 ? 'Exceeds RBI limit' : 'Within norms'} />
                    </div>
                  </div>

                  {/* XAI Explanation */}
                  {assessment.explanation?.length > 0 && (
                    <div className="bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-[30px] p-8">
                      <h3 className="text-lg font-bold dark:text-white mb-4">AI Decision Explanation</h3>
                      <div className="space-y-3">
                        {assessment.explanation.map((exp, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-zinc-50 dark:bg-white/[0.03] rounded-xl border border-zinc-100 dark:border-white/5">
                            <ImpactBadge impact={exp.impact} />
                            <div className="flex-1">
                              <div className="font-bold text-sm dark:text-white">{exp.factor}</div>
                              <div className="text-xs text-zinc-500 mt-0.5">{exp.detail}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* RBI Remarks */}
                  {assessment.rbi_remarks?.length > 0 && (
                    <div className="bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-[30px] p-8">
                      <h3 className="text-lg font-bold dark:text-white mb-4">Regulatory Observations (RBI)</h3>
                      <ul className="space-y-2">
                        {assessment.rbi_remarks.map((r, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                            <span className="text-amber-500 mt-0.5 font-bold">●</span>
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Apply Button */}
                  {assessment.eligible && (
                    <button onClick={handleApply}
                      className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-sm tracking-widest rounded-2xl transition-all hover:scale-[1.01] shadow-lg shadow-emerald-500/20">
                      Apply for ₹{parseFloat(amount).toLocaleString()} Loan at {assessment.recommended_interest_rate}% Interest
                    </button>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── TAB: My Loans ─── */}
      {activeTab === 'loans' && (
        <section className="space-y-6">
          <h2 className="text-xl font-bold dark:text-white">Active & Past Loans</h2>
          {loans.length === 0 ? (
            <div className="bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-[30px] p-10 text-center">
              <div className="text-4xl mb-4">💳</div>
              <p className="text-zinc-500">No loan history found. Check your eligibility and apply for a loan.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {loans.map(loan => (
                <div key={loan.id} className="bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-[30px] p-8 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <span className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Loan ID: {loan.id.split('-')[0]}</span>
                      <h3 className="text-2xl font-black dark:text-white mt-2">₹{loan.principal_amount.toLocaleString()}</h3>
                    </div>
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      loan.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
                      loan.status === 'PENDING' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' :
                      loan.status === 'REJECTED' ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' :
                      'bg-zinc-100 text-zinc-700 dark:bg-white/5 dark:text-zinc-400'
                    }`}>
                      {loan.status}
                    </span>
                  </div>
                  <div className="space-y-2 mb-8">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">Interest</span>
                      <span className="font-mono dark:text-white">{loan.interest_rate}% p.a.</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">Outstanding</span>
                      <span className="font-mono dark:text-white">₹{loan.outstanding_balance.toLocaleString()}</span>
                    </div>
                  </div>

                  {loan.status === 'ACTIVE' && (
                    <div>
                      {selectedLoan === loan.id ? (
                        <div className="flex gap-2">
                          <input type="number" value={repayAmount} onChange={(e) => setRepayAmount(e.target.value)}
                            placeholder="Amount" className="w-full px-4 py-2 bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-lg outline-none font-mono text-sm dark:text-white" />
                          <button onClick={() => handlePayEmi(loan.id)} className="px-4 bg-emerald-600 text-white rounded-lg text-xs font-bold uppercase hover:bg-emerald-500">Pay</button>
                          <button onClick={() => setSelectedLoan(null)} className="px-3 bg-zinc-200 dark:bg-white/10 dark:text-white rounded-lg text-xs font-bold uppercase hover:opacity-80">X</button>
                        </div>
                      ) : (
                        <button onClick={() => setSelectedLoan(loan.id)} className="w-full py-3 bg-zinc-100 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 border border-zinc-200 dark:border-white/10 rounded-xl font-bold text-sm uppercase tracking-widest transition-colors">
                          Pay EMI
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
