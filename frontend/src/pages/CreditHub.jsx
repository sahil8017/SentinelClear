import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../lib/axios';
import { useMinLoadingTime } from '../lib/useMinLoadingTime';
import { Skeleton } from '../components/ui/Skeleton';

function maskSensitiveIdentity(val) {
  if (!val) return val;
  const str = String(val);
  const aadhaarRegex = /\b\d{12}\b|\b\d{4}-\d{4}-\d{4}\b|\b\d{4} \d{4} \d{4}\b/;
  if (aadhaarRegex.test(str)) {
    return str.replace(aadhaarRegex, '[Aadhaar Redacted]');
  }
  return val;
}

/* ─── Horizontal Credit Score Progress Bar ─── */
function CreditScoreBar({ score }) {
  const min = 300, max = 900;
  const pct = Math.max(0, Math.min(1, (score - min) / (max - min))) * 100;

  const color =
    score >= 750 ? '#0CBF4C' :
    score >= 650 ? '#635BFF' :
    score >= 550 ? '#ff6118' : '#df1b41';

  const rating =
    score >= 800 ? 'EXCELLENT' :
    score >= 750 ? 'VERY GOOD' :
    score >= 700 ? 'GOOD' :
    score >= 650 ? 'FAIR' :
    score >= 550 ? 'POOR' : 'VERY POOR';

  return (
    <div style={{ width: '100%' }}>
      {/* Score Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
          <span style={{ fontSize: '36px', fontWeight: 300, color: '#0A2540', letterSpacing: '-1px', fontFamily: '"SF Mono", monospace' }}>
            {score}
          </span>
          <span style={{
            fontSize: '11px', fontWeight: 700, letterSpacing: '1.2px',
            color, textTransform: 'uppercase',
            padding: '3px 8px', borderRadius: '4px',
            backgroundColor: score >= 750 ? '#e7f9ed' : score >= 650 ? '#f0efff' : score >= 550 ? '#fff5f2' : '#fff5f5',
          }}>
            {rating}
          </span>
        </div>
        <span style={{ fontSize: '11px', color: '#6B7C93', fontWeight: 500 }}>CIBIL Range: 300–900</span>
      </div>

      {/* Progress Track */}
      <div style={{
        width: '100%', height: '10px',
        backgroundColor: '#e3e8ee', borderRadius: '5px',
        overflow: 'hidden', position: 'relative',
      }}>
        {/* Gradient fill */}
        <div style={{
          width: `${pct}%`, height: '100%',
          background: `linear-gradient(90deg, #df1b41 0%, #ff6118 30%, #635BFF 60%, #0CBF4C 100%)`,
          borderRadius: '5px',
          transition: 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }} />
      </div>

      {/* Range Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
        <span style={{ fontSize: '10px', color: '#6B7C93' }}>300</span>
        <span style={{ fontSize: '10px', color: '#6B7C93' }}>900</span>
      </div>

      {/* CIBIL Eligibility Tags */}
      <div style={{
        marginTop: '12px', padding: '10px 14px',
        backgroundColor: '#f6f9fc', border: '1px solid #e3e8ee', borderRadius: '8px',
        display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="material-symbols-outlined" style={{
            fontSize: '16px',
            color: score >= 600 ? '#0CBF4C' : '#df1b41',
          }}>
            {score >= 600 ? 'check_circle' : 'cancel'}
          </span>
          <span style={{ fontSize: '12px', color: '#425466', fontWeight: 500 }}>
            {score >= 600
              ? 'Eligible for Business Loans (Min 600)'
              : 'Below Business Loan threshold (Min 600)'}
          </span>
        </div>
        <span style={{ color: '#e3e8ee' }}>|</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="material-symbols-outlined" style={{
            fontSize: '16px',
            color: score >= 650 ? '#0CBF4C' : '#df1b41',
          }}>
            {score >= 650 ? 'check_circle' : 'cancel'}
          </span>
          <span style={{ fontSize: '12px', color: '#425466', fontWeight: 500 }}>
            {score >= 650
              ? 'Eligible for Personal Loans (Min 650)'
              : 'Below Personal Loan threshold (Min 650)'}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Impact Badge ─── */
function ImpactBadge({ impact }) {
  const styles = {
    POSITIVE: 'bg-[#e7f9ed] text-[#0CBF4C]',
    NEGATIVE: 'bg-[#fff5f5] text-[#df1b41]',
    NEUTRAL: 'bg-[#f6f9fc] text-[#6B7C93]',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${styles[impact] || styles.NEUTRAL}`}>
      {impact}
    </span>
  );
}

/* ─── Stat Card ─── */
function Stat({ label, value, sub }) {
  return (
    <div className="bg-white rounded-[8px] p-4 border border-[#e3e8ee] shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <div className="text-[11px] uppercase font-bold tracking-wider text-[#6B7C93] mb-1">{label}</div>
      <div className="text-[18px] font-light text-[#0A2540]">{value}</div>
      {sub && <div className="text-[11px] text-[#425466] mt-1">{sub}</div>}
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
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  /* 3-field lookup form */
  const [lookupForm, setLookupForm] = useState({ pan: '', contact: '', pin: '' });
  const [lookupError, setLookupError] = useState(null);

  /* Assessment */
  const [assessment, setAssessment] = useState(null);
  const [assessLoading, setAssessLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('profile');

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

  // 3-field lookup: identity-confirmation UI — actual score computed by backend from account data
  const handleLookupSubmit = async (e) => {
    e.preventDefault();
    setLookupError(null);
    if (!lookupForm.pan.trim() || !lookupForm.contact.trim() || !lookupForm.pin.trim()) {
      setLookupError('All fields are required to verify your identity.');
      return;
    }
    setProfileSubmitting(true);
    try {
      const { data } = await apiClient.get('/loans/credit-profile');
      setProfile(data);
    } catch (e) {
      if (e.response?.status === 404) {
        setLookupError('No credit profile found. Your score will be computed once you have transaction history.');
      } else {
        setLookupError('Failed to fetch credit profile. Please try again.');
      }
    } finally {
      setProfileSubmitting(false);
    }
  };

  // Derive KYC status pill from profile data
  const getKycStatus = (p) => {
    if (!p) return null;
    if (p.kyc_status === 'PAN_VERIFIED' || (p.credit_score && p.credit_score > 0))
      return { label: 'VERIFIED', color: '#0CBF4C', bg: '#e7f9ed', border: '#0CBF4C/20' };
    if (p.credit_score === 0)
      return { label: 'PROCESSING', color: '#ff6118', bg: '#fff5f2', border: '#ffe0d4' };
    return { label: 'AWAITING KYC', color: '#df1b41', bg: '#fff5f5', border: '#ffcdcd' };
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
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
        <header>
          <Skeleton className="w-48 h-8 mb-2 rounded" />
          <Skeleton className="w-72 h-4 rounded" />
        </header>
        <div className="bg-white border border-[#e3e8ee] rounded-[16px] p-6 space-y-6">
          <Skeleton className="w-56 h-6 mb-4 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-[8px]"/>)}
          </div>
          <Skeleton className="h-[130px] w-[220px] mx-auto rounded-[8px] mt-6" />
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
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 fade-in duration-500 pb-20">
      <header>
        <h1 className="text-[32px] md:text-[40px] font-light text-[#0A2540] m-0 tracking-tight">Credit Hub</h1>
        <p className="text-[15px] text-[#425466] mt-2 font-medium">AI-Powered Credit Scoring & Lending Engine</p>
      </header>

      {/* Tab Nav */}
      <div className="flex flex-wrap gap-2 bg-[#f6f9fc] p-1.5 rounded-[8px] w-fit border border-[#e3e8ee]">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-[6px] text-[13px] font-semibold transition-all ${
              activeTab === t.key
                ? 'bg-white text-[#0A2540] shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-[#e3e8ee]'
                : 'text-[#6B7C93] hover:text-[#0A2540] border border-transparent'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── TAB: Credit Profile ─── */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* Credit Score Bar + Status Pill (if profile exists) */}
          {profile && (
            <section className="bg-white border border-[#e3e8ee] rounded-[16px] p-6 md:p-8 shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
              {/* Score + Pill header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <p className="text-[11px] uppercase font-bold tracking-widest text-[#6B7C93] mb-2">Credit Score</p>
                  <CreditScoreBar score={profile.credit_score} />
                </div>
                {(() => {
                  const status = getKycStatus(profile);
                  return status ? (
                    <div className="shrink-0 flex flex-col items-start sm:items-end gap-1">
                      <p className="text-[11px] uppercase font-bold tracking-widest text-[#6B7C93]">KYC Status</p>
                      <span style={{ backgroundColor: status.bg, color: status.color, border: `1px solid ${status.color}30` }}
                        className="px-3 py-1.5 rounded-[6px] text-[12px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: status.color }} />
                        {status.label}
                      </span>
                      <p className="text-[11px] text-[#6B7C93] mt-1 max-w-[180px] text-right hidden sm:block">Score computed automatically from your transaction history and KYC data.</p>
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Progressive Disclosure */}
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-2 text-[13px] font-medium text-[#635BFF] hover:text-[#5851db] transition-colors mt-2"
              >
                <span className="material-symbols-outlined text-[16px]">{showDetails ? 'expand_less' : 'expand_more'}</span>
                {showDetails ? 'Hide Analysis' : 'View Full Analysis'}
              </button>

              {showDetails && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4 w-full animate-in fade-in slide-in-from-top-2 duration-200">
                  {profile.monthly_income !== undefined && <Stat label="Monthly Income" value={`₹${profile.monthly_income.toLocaleString()}`} />}
                  <Stat label="FOIR" value={`${(profile.foir * 100).toFixed(1)}%`} sub={profile.foir > 0.5 ? 'Above RBI limit' : 'Within norms'} />
                  <Stat label="Debt-to-Income" value={`${(profile.debt_to_income * 100).toFixed(1)}%`} />
                  <Stat label="Repayment Hit" value={`${(profile.repayment_history_score * 100).toFixed(0)}%`} />
                  <Stat label="Account Age" value={`${profile.account_age_months} mo`} />
                  <Stat label="Past Loans" value={profile.num_previous_loans} sub={profile.num_defaults > 0 ? `${profile.num_defaults} defaults` : '0 defaults'} />
                </div>
              )}
            </section>
          )}

          {/* 3-field Identity Lookup */}
          <section className="bg-[linear-gradient(180deg,#fafbfc_0%,#f6f9fc_100%)] border border-[#e3e8ee] rounded-[16px] p-6 md:p-8 shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
            <h2 className="text-[20px] font-medium text-[#0A2540] mb-1">{profile ? 'Refresh Credit Score' : 'Fetch Your Credit Score'}</h2>
            <p className="text-[#6B7C93] text-[13px] mb-2">Verify your identity to retrieve your bureau-computed score.</p>
            <p className="text-[12px] text-[#425466] mb-6 p-3 bg-white border border-[#e3e8ee] rounded-[8px] flex items-start gap-2">
              <span className="material-symbols-outlined text-[#635BFF] text-[16px] shrink-0">info</span>
              Your credit score is computed automatically from your transaction history, KYC status, and account data — no manual entry required.
            </p>

            <form onSubmit={handleLookupSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-[#0A2540] mb-1.5">PAN Number *</label>
                  <input
                    type="text" required maxLength={10}
                    value={lookupForm.pan}
                    onChange={e => setLookupForm(p => ({ ...p, pan: e.target.value.toUpperCase() }))}
                    placeholder="ABCDE1234F"
                    className="w-full px-4 py-3 bg-white border border-[#e3e8ee] rounded-[8px] outline-none text-[#0A2540] font-mono text-[14px] focus:border-[#635BFF] transition-colors shadow-sm min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#0A2540] mb-1.5">Mobile / Email *</label>
                  <input
                    type="text" required
                    value={lookupForm.contact}
                    onChange={e => setLookupForm(p => ({ ...p, contact: e.target.value }))}
                    placeholder="9876543210 or you@email.com"
                    className="w-full px-4 py-3 bg-white border border-[#e3e8ee] rounded-[8px] outline-none text-[#0A2540] text-[14px] focus:border-[#635BFF] transition-colors shadow-sm min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#0A2540] mb-1.5">Transaction PIN *</label>
                  <input
                    type="password" required maxLength={6}
                    value={lookupForm.pin}
                    onChange={e => setLookupForm(p => ({ ...p, pin: e.target.value }))}
                    placeholder="••••••"
                    className="w-full px-4 py-3 bg-white border border-[#e3e8ee] rounded-[8px] outline-none text-[#0A2540] font-mono text-[14px] focus:border-[#635BFF] transition-colors shadow-sm min-h-[44px]"
                  />
                </div>
              </div>

              {lookupError && (
                <div className="p-3 bg-[#fff5f5] border border-[#ffcdcd] rounded-[8px] flex items-start gap-2">
                  <span className="material-symbols-outlined text-[#df1b41] text-[16px] shrink-0">error</span>
                  <p className="text-[13px] text-[#df1b41] font-medium">{lookupError}</p>
                </div>
              )}

              <div className="flex flex-col items-start gap-2">
                <button type="submit" disabled={profileSubmitting}
                  className="px-8 py-3 bg-[#635BFF] hover:bg-[#5851db] text-white font-medium text-[14px] rounded-[8px] transition-all disabled:opacity-50 shadow-[0_2px_5px_rgba(99,91,255,0.3)] flex items-center gap-2 min-h-[44px]">
                  {profileSubmitting
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Fetching Score...</>
                    : <><span className="material-symbols-outlined text-[18px]">search</span> Fetch Score</>}
                </button>
                <p className="text-[12px] text-[#6B7C93] font-medium mt-1">
                  Bureau Query Fee: ₹35.00 (Deducted from pre-seeded balance)
                </p>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ─── TAB: Loan Eligibility ─── */}
      {activeTab === 'assess' && (
        <div className="space-y-6">
          {!profile ? (
            <div className="bg-white border border-[#e3e8ee] rounded-[16px] p-10 text-center shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
              <span className="material-symbols-outlined text-[48px] text-[#6B7C93] mb-4 block">assignment_ind</span>
              <h3 className="text-[18px] font-medium text-[#0A2540] mb-2">Profile Required</h3>
              <p className="text-[#6B7C93] text-[14px] mb-6">Complete your financial profile to check API eligibility.</p>
              <button onClick={() => setActiveTab('profile')} className="px-5 py-2.5 bg-[#635BFF] text-white font-medium text-[14px] rounded-[8px] hover:bg-[#5851db] transition-colors">
                Go to Profile
              </button>
            </div>
          ) : (
            <>
              {/* Current Score */}
              <section className="bg-white border border-[#e3e8ee] rounded-[16px] p-6 shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
                <div className="space-y-6 mb-4">
                  <CreditScoreBar score={profile.credit_score} />
                  <div className="w-full">
                    <h2 className="text-[20px] font-medium text-[#0A2540] mb-4">Calculate Loan Scenarios</h2>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-1">
                        <label className="block text-[12px] font-medium text-[#0A2540] mb-1.5">Amount (₹)</label>
                        <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                          placeholder="100000" className="w-full px-4 py-2.5 bg-[#f6f9fc] focus:bg-white border border-[#e3e8ee] rounded-[8px] outline-none text-[#0A2540] font-mono text-[14px] focus:border-[#635BFF] transition-colors" />
                      </div>
                      <div className="sm:w-32">
                        <label className="block text-[12px] font-medium text-[#0A2540] mb-1.5">Tenure</label>
                        <select value={tenure} onChange={e => setTenure(e.target.value)}
                          className="w-full px-4 py-2.5 bg-[#f6f9fc] focus:bg-white border border-[#e3e8ee] rounded-[8px] outline-none text-[#0A2540] text-[14px] focus:border-[#635BFF] transition-colors">
                          {[6,12,18,24,36,48,60].map(m => <option key={m} value={m}>{m} mo</option>)}
                        </select>
                      </div>
                      <div className="flex items-end">
                        <button onClick={handleCheckEligibility} disabled={!amount || assessLoading}
                          className="w-full sm:w-auto px-6 py-2.5 bg-[#635BFF] text-white font-medium text-[14px] rounded-[8px] hover:bg-[#5851db] transition-colors disabled:opacity-50 shadow-[0_2px_5px_rgba(99,91,255,0.3)]">
                          {assessLoading ? 'Analyzing...' : 'Check'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Assessment Results */}
              {assessment && (
                <section className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
                  {/* Verdict */}
                  <div className={`rounded-[12px] p-6 border ${
                    assessment.eligible
                      ? 'bg-[#e7f9ed] border-[#0CBF4C]/20'
                      : 'bg-[#fff5f5] border-[#ffcdcd]'
                  }`}>
                    <div className="flex items-center gap-4 mb-6">
                      <div className={`w-12 h-12 rounded flex items-center justify-center text-2xl shrink-0 ${
                        assessment.eligible ? 'bg-[#0CBF4C]/10 text-[#0CBF4C]' : 'bg-[#df1b41]/10 text-[#df1b41]'
                      }`}>
                        <span className="material-symbols-outlined">{assessment.eligible ? 'check_circle' : 'cancel'}</span>
                      </div>
                      <div>
                        <h3 className={`text-[20px] font-medium ${assessment.eligible ? 'text-[#0CBF4C]' : 'text-[#df1b41]'}`}>
                          {assessment.eligible ? 'Loan Approved' : 'Not Eligible'}
                        </h3>
                        <p className="text-[13px] text-[#425466] mt-0.5">
                          Risk: <span className="font-semibold">{assessment.ml_risk_category}</span> · Score: <span className="font-mono">{(assessment.ml_eligibility_score * 100).toFixed(1)}%</span>
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <Stat label="Score" value={assessment.credit_score} sub={assessment.credit_rating} />
                      <Stat label="Max Amount" value={`₹${assessment.max_eligible_amount.toLocaleString()}`} />
                      <Stat label="Rate" value={`${assessment.recommended_interest_rate}%`} sub="Adjusted Risk" />
                      <Stat label="FOIR" value={`${(assessment.foir * 100).toFixed(1)}%`} sub={assessment.foir > 0.5 ? 'High' : 'Normal'} />
                    </div>
                  </div>

                  {/* AI Explanation */}
                  {assessment.explanation?.length > 0 && (
                    <div className="bg-white border border-[#e3e8ee] rounded-[16px] p-6 shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
                      <h3 className="text-[16px] font-medium text-[#0A2540] mb-4">Engine Logic</h3>
                      <div className="space-y-3">
                        {assessment.explanation.map((exp, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-[#f6f9fc] rounded-[8px] border border-[#e3e8ee]">
                            <ImpactBadge impact={exp.impact} />
                            <div className="flex-1">
                              <div className="font-medium text-[13px] text-[#0A2540]">{maskSensitiveIdentity(exp.factor)}</div>
                              <div className="text-[12px] text-[#6B7C93] mt-0.5">{maskSensitiveIdentity(exp.detail)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* RBI Remarks */}
                  {assessment.rbi_remarks?.length > 0 && (
                    <div className="bg-[#fff5f2] border border-[#ffe0d4] rounded-[16px] p-6">
                      <h3 className="text-[16px] font-medium text-[#ff6118] mb-3">Regulatory Audit (RBI)</h3>
                      <ul className="space-y-2">
                        {assessment.rbi_remarks.map((r, i) => (
                          <li key={i} className="flex items-start gap-2 text-[13px] text-[#425466]">
                            <span className="text-[#ff6118] font-bold">●</span>
                            {maskSensitiveIdentity(r)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Apply Button */}
                  {assessment.eligible && (
                    <button onClick={handleApply}
                      className="w-full py-3.5 bg-[#635BFF] hover:bg-[#5851db] text-white font-medium text-[15px] rounded-[8px] transition-all shadow-[0_2px_5px_rgba(99,91,255,0.3)]">
                      Commit Final Drawdown: ₹{parseFloat(amount).toLocaleString()} @ {assessment.recommended_interest_rate}%
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
          <h2 className="text-[20px] font-medium text-[#0A2540]">Active Liabilities</h2>
          {loans.length === 0 ? (
            <div className="bg-[#f6f9fc] border border-[#e3e8ee] rounded-[16px] p-10 text-center">
              <span className="material-symbols-outlined text-[48px] text-[#6B7C93] mb-4 block">receipt_long</span>
              <p className="text-[#425466] text-[14px]">No active credit found. Start an assessment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {loans.map(loan => (
                <div key={loan.id} className="bg-white border border-[#e3e8ee] rounded-[12px] p-6 flex flex-col justify-between shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-[11px] uppercase font-bold tracking-widest text-[#6B7C93]">Loan ID: {loan.id.split('-')[0]}</span>
                      <h3 className="text-[28px] font-light text-[#0A2540] mt-1 tracking-tight">₹{loan.principal_amount.toLocaleString()}</h3>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      loan.status === 'ACTIVE' ? 'bg-[#e7f9ed] text-[#0CBF4C]' :
                      loan.status === 'PENDING' ? 'bg-[#fff5f2] text-[#ff6118]' :
                      loan.status === 'REJECTED' ? 'bg-[#fff5f5] text-[#df1b41]' :
                      'bg-[#f6f9fc] text-[#6B7C93]'
                    }`}>
                      {loan.status}
                    </span>
                  </div>
                  <div className="space-y-2 mb-6">
                    <div className="flex justify-between text-[13px] border-b border-[#e3e8ee] pb-2">
                       <span className="text-[#6B7C93]">Interest Rate</span>
                       <span className="font-mono text-[#0A2540] font-medium">{loan.interest_rate}% p.a.</span>
                    </div>
                    <div className="flex justify-between text-[13px] pt-1">
                       <span className="text-[#6B7C93]">Remaining</span>
                       <span className="font-mono text-[#0A2540] font-medium">₹{loan.outstanding_balance.toLocaleString()}</span>
                    </div>
                  </div>

                  {loan.status === 'ACTIVE' && (
                    <div>
                      {selectedLoan === loan.id ? (
                        <div className="flex gap-2">
                          <input type="number" value={repayAmount} onChange={(e) => setRepayAmount(e.target.value)}
                            placeholder="Amt (₹)" className="w-full px-3 py-2 bg-[#f6f9fc] border border-[#e3e8ee] rounded-[6px] outline-none font-mono text-[13px] text-[#0A2540]" />
                          <button onClick={() => handlePayEmi(loan.id)} className="px-4 bg-[#635BFF] text-white rounded-[6px] text-[12px] font-medium hover:bg-[#5851db]">Pay</button>
                          <button onClick={() => setSelectedLoan(null)} className="px-3 bg-white border border-[#e3e8ee] text-[#6B7C93] rounded-[6px] text-[12px] hover:bg-[#f6f9fc]">✖</button>
                        </div>
                      ) : (
                        <button onClick={() => setSelectedLoan(loan.id)} className="w-full py-2.5 bg-white border border-[#e3e8ee] text-[#0A2540] hover:bg-[#f6f9fc] rounded-[6px] font-medium text-[13px] transition-colors">
                          Make Payment
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
