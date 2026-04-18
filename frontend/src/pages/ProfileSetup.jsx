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
      // Step 1: Save personal info via PATCH
      await apiClient.patch('/auth/profile', {
        full_name: form.full_name,
        date_of_birth: form.date_of_birth,
        occupation: form.occupation,
      });

      // Step 2: If PIN was provided, set it separately
      if (form.transaction_pin) {
        try {
          await apiClient.post('/auth/transaction-pin', { pin: form.transaction_pin });
        } catch {}
      }

      // Step 3: Mark profile as complete
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
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-[#060607] px-4">
      <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Progress Bar */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2].map(s => (
            <div key={s} className="flex-1 flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                step >= s ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-zinc-200 dark:bg-white/10 text-zinc-400'
              }`}>{s}</div>
              {s < 2 && <div className={`flex-1 h-0.5 rounded-full transition-all ${step > s ? 'bg-indigo-500' : 'bg-zinc-200 dark:bg-white/10'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-3xl p-8 shadow-xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-indigo-500 text-3xl">
                {step === 1 ? 'person' : 'pin'}
              </span>
            </div>
            <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
              {step === 1 ? 'Complete Your Profile' : 'Set Transaction PIN'}
            </h1>
            <p className="text-sm text-zinc-500 mt-2">
              {step === 1 ? 'We need a few details to get started' : 'Secure your high-value transactions'}
            </p>
          </div>

          {step === 1 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.1em]">Full Name *</label>
                <input type="text" value={form.full_name}
                  onChange={e => setForm({...form, full_name: e.target.value})}
                  className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-zinc-900 dark:text-white"
                  placeholder="Enter your full name" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.1em]">Date of Birth *</label>
                <input type="date" value={form.date_of_birth}
                  onChange={e => setForm({...form, date_of_birth: e.target.value})}
                  className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-zinc-900 dark:text-white" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.1em]">Occupation *</label>
                <select value={form.occupation}
                  onChange={e => setForm({...form, occupation: e.target.value})}
                  className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-zinc-900 dark:text-white appearance-none">
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
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest rounded-xl text-[11px] transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2">
                Continue <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl mb-2">
                <p className="text-xs text-amber-600 dark:text-amber-400 font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">info</span>
                  PIN is used for Step-Up Authentication on high-value transfers. You can skip this and set it later.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.1em]">Transaction PIN (4-6 digits)</label>
                <input type="password" value={form.transaction_pin} maxLength={6}
                  onChange={e => setForm({...form, transaction_pin: e.target.value.replace(/\D/g, '')})}
                  className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-xl px-4 py-3.5 text-sm font-mono tracking-[0.5em] text-center outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-zinc-900 dark:text-white"
                  placeholder="• • • •" />
              </div>

              {form.transaction_pin && (
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  <label className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.1em]">Confirm PIN</label>
                  <input type="password" value={form.confirm_pin} maxLength={6}
                    onChange={e => setForm({...form, confirm_pin: e.target.value.replace(/\D/g, '')})}
                    className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-xl px-4 py-3.5 text-sm font-mono tracking-[0.5em] text-center outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-zinc-900 dark:text-white"
                    placeholder="• • • •" />
                </div>
              )}

              <div className="flex gap-3 mt-2">
                <button onClick={() => setStep(1)}
                  className="flex-1 py-4 bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-300 font-black uppercase tracking-widest rounded-xl text-[11px] transition-all hover:bg-zinc-200 dark:hover:bg-white/10">
                  Back
                </button>
                <button onClick={handleSubmit} disabled={isSubmitting}
                  className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest rounded-xl text-[11px] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
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

        <p className="text-center text-[10px] text-zinc-400 mt-6 font-bold uppercase tracking-widest">
          SentinelClear · Secure Onboarding
        </p>
      </div>
    </div>
  );
}
