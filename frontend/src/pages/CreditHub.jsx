import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../lib/axios';
import { useMinLoadingTime } from '../lib/useMinLoadingTime';
import { Skeleton } from '../components/ui/Skeleton';

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
  const [profileForm, setProfileForm] = useState({
    monthly_income: '', existing_liabilities: '', total_assets: '',
    employment_type: 'salaried', employment_years: '', age: '',
    dependents: '0', residence_type: 'rented',
  });
  const [profileSubmitting, setProfileSubmitting] = useState(false);

  /* Assessment */
  const [assessment, setAssessment] = useState(null);
  const [assessLoading, setAssessLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('profile');

  const showSkeleton = useMinLoadingTime(isLoading, 1200);

  /* ─── DSCR Calculation ─── */
  const dscr = useMemo(() => {
    const income = parseFloat(profileForm.monthly_income) || 0;
    const emis = parseFloat(profileForm.existing_liabilities) || 0;
    if (emis <= 0) return null; // DSCR is undefined when no EMIs
    return income / emis;
  }, [profileForm.monthly_income, profileForm.existing_liabilities]);

  /* ─── Age Validation ─── */
  const age = parseInt(profileForm.age) || 0;
  const ageBlocked = age > 0 && (age < 21 || age > 65);

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
    if (ageBlocked) return;
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
          {/* Credit Score Bar + Stats (if profile exists) */}
          {profile && (
            <section className="bg-white border border-[#e3e8ee] rounded-[16px] p-6 md:p-8 shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
              <div className="space-y-6">
                <CreditScoreBar score={profile.credit_score} />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full">
                  <Stat label="Monthly Income" value={`₹${profile.monthly_income.toLocaleString()}`} />
                  <Stat label="FOIR" value={`${(profile.foir * 100).toFixed(1)}%`} sub={profile.foir > 0.5 ? 'Above RBI limit' : 'Within norms'} />
                  <Stat label="Debt-to-Income" value={`${(profile.debt_to_income * 100).toFixed(1)}%`} />
                  <Stat label="Repayment Hit" value={`${(profile.repayment_history_score * 100).toFixed(0)}%`} />
                  <Stat label="Account Age" value={`${profile.account_age_months} mo`} />
                  <Stat label="Past Loans" value={profile.num_previous_loans} sub={profile.num_defaults > 0 ? `${profile.num_defaults} defaults` : '0 defaults'} />
                </div>
              </div>
            </section>
          )}

          {/* Profile Form */}
          <section className="bg-[linear-gradient(180deg,#fafbfc_0%,#f6f9fc_100%)] border border-[#e3e8ee] rounded-[16px] p-6 md:p-8 shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
            <h2 className="text-[20px] font-medium text-[#0A2540] mb-1">{profile ? 'Update Financial Profile' : 'Submit Financial Profile'}</h2>
            <p className="text-[#6B7C93] text-[13px] mb-6">Required for credit assessment as per KYC norms.</p>
            <form onSubmit={handleProfileSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-[#0A2540] mb-1.5">Monthly Income (₹) *</label>
                  <input type="number" required value={profileForm.monthly_income} onChange={e => setProfileForm(p => ({...p, monthly_income: e.target.value}))}
                    placeholder="55000" className="w-full px-4 py-2.5 bg-white border border-[#e3e8ee] rounded-[8px] outline-none text-[#0A2540] font-mono text-[14px] focus:border-[#635BFF] transition-colors shadow-sm" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#0A2540] mb-1.5">Existing EMIs (₹)</label>
                  <input type="number" value={profileForm.existing_liabilities} onChange={e => setProfileForm(p => ({...p, existing_liabilities: e.target.value}))}
                    placeholder="0" className="w-full px-4 py-2.5 bg-white border border-[#e3e8ee] rounded-[8px] outline-none text-[#0A2540] font-mono text-[14px] focus:border-[#635BFF] transition-colors shadow-sm" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#0A2540] mb-1.5">Total Assets (₹)</label>
                  <input type="number" value={profileForm.total_assets} onChange={e => setProfileForm(p => ({...p, total_assets: e.target.value}))}
                    placeholder="500000" className="w-full px-4 py-2.5 bg-white border border-[#e3e8ee] rounded-[8px] outline-none text-[#0A2540] font-mono text-[14px] focus:border-[#635BFF] transition-colors shadow-sm" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#0A2540] mb-1.5">Age *</label>
                  <input type="number" required min="18" max="80" value={profileForm.age} onChange={e => setProfileForm(p => ({...p, age: e.target.value}))}
                    placeholder="28" className={`w-full px-4 py-2.5 bg-white border rounded-[8px] outline-none text-[#0A2540] font-mono text-[14px] focus:border-[#635BFF] transition-colors shadow-sm ${ageBlocked ? 'border-[#df1b41]' : 'border-[#e3e8ee]'}`} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-[#0A2540] mb-1.5">Employment Type</label>
                  <select value={profileForm.employment_type} onChange={e => setProfileForm(p => ({...p, employment_type: e.target.value}))}
                    className="w-full px-4 py-2.5 bg-white border border-[#e3e8ee] rounded-[8px] outline-none text-[#0A2540] text-[14px] focus:border-[#635BFF] transition-colors shadow-sm">
                    <option value="salaried">Salaried</option>
                    <option value="self_employed">Self-Employed</option>
                    <option value="freelancer">Freelancer</option>
                    <option value="unemployed">Unemployed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#0A2540] mb-1.5">Employment Yrs</label>
                  <input type="number" step="0.5" value={profileForm.employment_years} onChange={e => setProfileForm(p => ({...p, employment_years: e.target.value}))}
                    placeholder="5" className="w-full px-4 py-2.5 bg-white border border-[#e3e8ee] rounded-[8px] outline-none text-[#0A2540] font-mono text-[14px] focus:border-[#635BFF] transition-colors shadow-sm" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#0A2540] mb-1.5">Dependents</label>
                  <input type="number" min="0" max="15" value={profileForm.dependents} onChange={e => setProfileForm(p => ({...p, dependents: e.target.value}))}
                    placeholder="0" className="w-full px-4 py-2.5 bg-white border border-[#e3e8ee] rounded-[8px] outline-none text-[#0A2540] font-mono text-[14px] focus:border-[#635BFF] transition-colors shadow-sm" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#0A2540] mb-1.5">Residence</label>
                  <select value={profileForm.residence_type} onChange={e => setProfileForm(p => ({...p, residence_type: e.target.value}))}
                    className="w-full px-4 py-2.5 bg-white border border-[#e3e8ee] rounded-[8px] outline-none text-[#0A2540] text-[14px] focus:border-[#635BFF] transition-colors shadow-sm">
                    <option value="rented">Rented</option>
                    <option value="owned">Owned</option>
                    <option value="parental">Parental</option>
                  </select>
                </div>
              </div>

              {/* ── Age Regulatory Block ── */}
              {ageBlocked && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px 16px',
                  backgroundColor: '#fff5f5', border: '1px solid #ffcdcd', borderRadius: '10px',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#df1b41' }}>block</span>
                  <span style={{ fontSize: '13px', color: '#df1b41', fontWeight: 600 }}>
                    Regulatory Block: Applicant age must be between 21 and 65 years for credit eligibility.
                  </span>
                </div>
              )}

              {/* ── DSCR Warning ── */}
              {dscr !== null && dscr < 1.25 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px 16px',
                  backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#d97706' }}>warning</span>
                  <span style={{ fontSize: '13px', color: '#92400e', fontWeight: 500 }}>
                    DSCR is {dscr.toFixed(2)}x — below the 1.25x regulatory minimum. Loan approval may be impacted.
                  </span>
                </div>
              )}

              {/* ── DSCR Info (when healthy) ── */}
              {dscr !== null && dscr >= 1.25 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 16px',
                  backgroundColor: '#e7f9ed', border: '1px solid #bef5cb', borderRadius: '10px',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#0CBF4C' }}>check_circle</span>
                  <span style={{ fontSize: '13px', color: '#0a6c2e', fontWeight: 500 }}>
                    DSCR: {dscr.toFixed(2)}x — meets the 1.25x regulatory minimum.
                  </span>
                </div>
              )}

              <button type="submit" disabled={profileSubmitting || !profileForm.monthly_income || !profileForm.age || ageBlocked}
                className="px-6 py-2.5 bg-[#635BFF] hover:bg-[#5851db] text-white font-medium text-[14px] rounded-[8px] transition-all disabled:opacity-50 shadow-[0_2px_5px_rgba(99,91,255,0.3)]">
                {profileSubmitting ? 'Saving...' : profile ? 'Update Profile' : 'Save Profile'}
              </button>
            </form>
          </section>

          {/* ── KYC Document Checklist ── */}
          <section className="bg-white border border-[#e3e8ee] rounded-[16px] p-6 md:p-8 shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#635BFF' }}>fact_check</span>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#0A2540', margin: 0 }}>KYC Document Requirements</h3>
            </div>
            <p style={{ fontSize: '13px', color: '#6B7C93', marginBottom: '16px' }}>
              The following documents are required for credit underwriting as per RBI Fair Practices Code.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { doc: 'Latest 2 Years Income Tax Returns (ITR)', icon: 'description' },
                { doc: '6-Months Bank Statements (Primary Account)', icon: 'account_balance' },
                { doc: 'PAN Card (Mandatory for loans > ₹50,000)', icon: 'badge' },
                { doc: 'Address Proof (Aadhaar / Utility Bill)', icon: 'home' },
              ].map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 16px',
                  backgroundColor: '#f6f9fc', border: '1px solid #e3e8ee', borderRadius: '8px',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#6B7C93' }}>{item.icon}</span>
                  <span style={{ fontSize: '13px', color: '#425466', fontWeight: 500 }}>{item.doc}</span>
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px',
                    color: '#6B7C93', backgroundColor: '#e3e8ee', padding: '2px 8px', borderRadius: '4px',
                  }}>Required</span>
                </div>
              ))}
            </div>
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
                              <div className="font-medium text-[13px] text-[#0A2540]">{exp.factor}</div>
                              <div className="text-[12px] text-[#6B7C93] mt-0.5">{exp.detail}</div>
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
                            {r}
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
