import React, { useState } from 'react';
import apiClient from '../lib/axios';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export function ProfileSetup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    date_of_birth: '',
    occupation: '',
    transaction_pin: '',
    confirm_pin: '',
  });

  const occupations = [
    'Software Engineer', 'Doctor', 'Teacher', 'Business Owner',
    'Government Employee', 'Student', 'Retired', 'Freelancer',
    'Accountant', 'Lawyer', 'Other',
  ];

  const handleSubmit = async () => {
    if (!form.full_name || !form.date_of_birth || !form.occupation) {
      toast.error('Please fill all required fields');
      return;
    }
    if (form.transaction_pin && form.transaction_pin !== form.confirm_pin) {
      toast.error('PINs do not match');
      return;
    }
    if (form.transaction_pin && form.transaction_pin.length < 4) {
      toast.error('PIN must be at least 4 digits');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.patch('/auth/profile', {
        full_name: form.full_name,
        date_of_birth: form.date_of_birth,
        occupation: form.occupation,
      });

      if (form.transaction_pin) {
        try {
          await apiClient.post('/auth/transaction-pin', { pin: form.transaction_pin });
        } catch {}
      }

      await apiClient.patch('/auth/profile', { profile_complete: true });

      toast.success('Profile setup complete!', { duration: 3000 });
      navigate('/app/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Profile setup failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f9fc] px-4">
      <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Progress Bar */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2].map(s => (
            <div key={s} className="flex-1 flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold transition-all ${
                step >= s ? 'bg-[#635BFF] text-white shadow-[0_2px_5px_rgba(99,91,255,0.3)]' : 'bg-[#e3e8ee] text-[#6B7C93]'
              }`}>{s}</div>
              {s < 2 && <div className={`flex-1 h-0.5 rounded-full transition-all ${step > s ? 'bg-[#635BFF]' : 'bg-[#e3e8ee]'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white border border-[#e3e8ee] rounded-[16px] p-6 md:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-[12px] bg-[#f0eeff] flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[#635BFF] text-[28px]">
                {step === 1 ? 'person' : 'pin'}
              </span>
            </div>
            <h1 className="text-[24px] font-medium text-[#0A2540]">
              {step === 1 ? 'Complete Your Profile' : 'Set Transaction PIN'}
            </h1>
            <p className="text-[14px] text-[#6B7C93] mt-2">
              {step === 1 ? 'We need a few details to get started' : 'Secure your high-value transactions'}
            </p>
          </div>

          {step === 1 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-[#0A2540]">Full Name *</label>
                <input type="text" value={form.full_name}
                  onChange={e => setForm({...form, full_name: e.target.value})}
                  className="w-full bg-[#f6f9fc] focus:bg-white border border-[#e3e8ee] rounded-[8px] px-4 py-3 text-[14px] outline-none focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/20 transition-all text-[#0A2540]"
                  placeholder="Enter your full name" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-[#0A2540]">Date of Birth *</label>
                <input type="date" value={form.date_of_birth}
                  onChange={e => setForm({...form, date_of_birth: e.target.value})}
                  className="w-full bg-[#f6f9fc] focus:bg-white border border-[#e3e8ee] rounded-[8px] px-4 py-3 text-[14px] outline-none focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/20 transition-all text-[#0A2540]" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-[#0A2540]">Occupation *</label>
                <select value={form.occupation}
                  onChange={e => setForm({...form, occupation: e.target.value})}
                  className="w-full bg-[#f6f9fc] focus:bg-white border border-[#e3e8ee] rounded-[8px] px-4 py-3 text-[14px] outline-none focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/20 transition-all text-[#0A2540]">
                  <option value="">Select occupation...</option>
                  {occupations.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              <button onClick={() => {
                if (!form.full_name || !form.date_of_birth || !form.occupation) {
                  toast.error('Please fill all required fields');
                  return;
                }
                setStep(2);
              }}
                className="w-full py-3 bg-[#635BFF] hover:bg-[#5851db] text-white font-medium rounded-[8px] text-[15px] transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2 shadow-[0_2px_5px_rgba(99,91,255,0.3)]">
                Continue <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="p-3 bg-[#fff5f2] border border-[#ffe0d4] rounded-[8px]">
                <p className="text-[12px] text-[#ff6118] font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px]">info</span>
                  PIN is used for Step-Up Authentication on high-value transfers. You can skip this.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-[#0A2540]">Transaction PIN (4-6 digits)</label>
                <input type="password" value={form.transaction_pin} maxLength={6}
                  onChange={e => setForm({...form, transaction_pin: e.target.value.replace(/\D/g, '')})}
                  className="w-full bg-[#f6f9fc] focus:bg-white border border-[#e3e8ee] rounded-[8px] px-4 py-3 text-[14px] font-mono tracking-[0.5em] text-center outline-none focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/20 transition-all text-[#0A2540]"
                  placeholder="• • • •" />
              </div>

              {form.transaction_pin && (
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  <label className="text-[12px] font-medium text-[#0A2540]">Confirm PIN</label>
                  <input type="password" value={form.confirm_pin} maxLength={6}
                    onChange={e => setForm({...form, confirm_pin: e.target.value.replace(/\D/g, '')})}
                    className="w-full bg-[#f6f9fc] focus:bg-white border border-[#e3e8ee] rounded-[8px] px-4 py-3 text-[14px] font-mono tracking-[0.5em] text-center outline-none focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/20 transition-all text-[#0A2540]"
                    placeholder="• • • •" />
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 mt-2">
                <button onClick={() => setStep(1)}
                  className="flex-1 py-3 bg-white border border-[#e3e8ee] text-[#425466] font-medium rounded-[8px] text-[14px] transition-colors hover:bg-[#f6f9fc]">
                  Back
                </button>
                <button onClick={handleSubmit} disabled={isSubmitting}
                  className="flex-[2] py-3 bg-[#0A2540] hover:bg-[#112F4E] text-white font-medium rounded-[8px] text-[14px] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
                  {isSubmitting ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Saving...</>
                  ) : (
                    <>{form.transaction_pin ? 'Complete Setup' : 'Skip PIN & Finish'}</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-[#6B7C93] mt-6 font-medium">
          SentinelClear · Secure Onboarding
        </p>
      </div>
    </div>
  );
}
