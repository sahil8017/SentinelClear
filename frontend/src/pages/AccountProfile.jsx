import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../lib/axios';
import { toast } from 'sonner';
import { formatINR } from '../lib/format';
import { useMinLoadingTime } from '../lib/useMinLoadingTime';
import { Skeleton } from '../components/ui/Skeleton';

export function AccountProfile() {
  const [account, setAccount] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: '', occupation: '', date_of_birth: '' });



  const showSkeleton = useMinLoadingTime(isLoading, 1200);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [accRes, profRes] = await Promise.allSettled([
        apiClient.get('/accounts/me'),
        apiClient.get('/auth/profile'),
      ]);
      if (accRes.status === 'fulfilled') setAccount(accRes.value.data);
      if (profRes.status === 'fulfilled') {
        const p = profRes.value.data;
        setProfile(p);
        setForm({
          full_name: p.full_name || '',
          occupation: p.occupation || '',
          date_of_birth: p.date_of_birth || '',
        });
      }
    } catch {
      toast.error('Failed to load account data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {};
      if (form.full_name !== (profile?.full_name || '')) payload.full_name = form.full_name;
      if (form.occupation !== (profile?.occupation || '')) payload.occupation = form.occupation;
      if (form.date_of_birth !== (profile?.date_of_birth || '')) payload.date_of_birth = form.date_of_birth;

      if (Object.keys(payload).length === 0) {
        toast.info('No changes to save');
        setEditing(false);
        setSaving(false);
        return;
      }

      const res = await apiClient.patch('/auth/profile', payload);
      setProfile(res.data);
      setForm({
        full_name: res.data.full_name || '',
        occupation: res.data.occupation || '',
        date_of_birth: res.data.date_of_birth || '',
      });
      setEditing(false);
      toast.success('Profile updated successfully');
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };



  const copyText = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch { return dateStr; }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return dateStr; }
  };

  if (showSkeleton) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-pulse">
        <div className="space-y-3 px-2">
          <Skeleton className="w-56 h-10" />
          <Skeleton className="w-96 h-4" />
        </div>
        <div className="bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-3xl p-8">
          <div className="flex items-center gap-5 mb-8">
            <Skeleton className="w-16 h-16 rounded-2xl" />
            <div className="flex-1 space-y-2"><Skeleton className="w-48 h-6" /><Skeleton className="w-32 h-3" /></div>
            <Skeleton className="w-40 h-8" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-2xl p-6">
              <Skeleton className="w-24 h-3 mb-4" /><Skeleton className="w-3/4 h-5" />
            </div>
          ))}
        </div>
        <div className="bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-3xl p-8">
          <Skeleton className="w-40 h-5 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="w-full h-12 rounded-xl" /><Skeleton className="w-full h-12 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500 pb-20">
      {/* ═══ PAGE HEADER ═══ */}
      <div className="px-2">
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-slate-900 dark:text-white">
          Account Profile
        </h1>
        <p className="text-sm text-zinc-500 mt-2 max-w-lg leading-relaxed font-medium">
          Manage your identity, view account details, and configure security settings.
        </p>
      </div>

      {/* ═══ IDENTITY CARD ═══ */}
      <div className="bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-3xl p-8 shadow-sm overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-56 h-56 bg-indigo-500/5 rounded-full blur-[100px] -z-10 group-hover:bg-indigo-500/10 transition-all duration-700"></div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-violet-600 dark:from-white dark:to-zinc-200 rounded-2xl flex items-center justify-center shadow-lg shrink-0">
              <span className="material-symbols-outlined text-white dark:text-black text-3xl">person</span>
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {profile?.full_name || profile?.username || 'User'}
              </h2>
              <p className="text-sm text-zinc-500 font-medium mt-0.5">{profile?.email || '—'}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                  profile?.role === 'ADMIN' 
                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
                }`}>
                  {profile?.role || 'USER'}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                  profile?.profile_complete
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    : 'bg-zinc-200 text-zinc-500 border-zinc-300 dark:bg-white/5 dark:border-white/10'
                }`}>
                  {profile?.profile_complete ? '✓ Profile Complete' : 'Profile Incomplete'}
                </span>
                {profile?.is_disabled && (
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border bg-blue-500/10 text-blue-500 border-blue-500/20">
                    Accessibility
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase font-black tracking-widest text-zinc-400 mb-1">Available Balance</p>
            <p className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white font-mono">
              {account ? formatINR(account.balance) : '—'}
            </p>
            <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 mt-1">
              {account?.account_type?.toUpperCase() || 'SAVINGS'} Account
            </p>
          </div>
        </div>
      </div>

      {/* ═══ ACCOUNT DETAILS GRID ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <DetailCard label="Account ID" value={account?.id || '—'} icon="fingerprint" mono onCopy={account?.id ? () => copyText(account.id) : undefined} />
        <DetailCard label="Username" value={profile?.username || '—'} icon="alternate_email" />
        <DetailCard label="Email" value={profile?.email || '—'} icon="mail" />
        <DetailCard label="Date of Birth" value={formatDate(profile?.date_of_birth)} icon="cake" />
        <DetailCard label="Member Since" value={profile?.created_at ? formatDateTime(profile.created_at) : '—'} icon="calendar_month" />
        <DetailCard label="Trusted Person" value={profile?.trusted_person_username || 'Not Set'} icon="supervised_user_circle" />
      </div>

      {/* ═══ EDITABLE PROFILE ═══ */}
      <div className="bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-3xl p-8 shadow-sm">
        <div className="flex items-center justify-between mb-8 border-b border-zinc-100 dark:border-white/5 pb-5">
          <div>
            <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight">Personal Information</h3>
            <p className="text-[11px] text-zinc-500 font-medium mt-1">Update your profile details below</p>
          </div>
          {!editing ? (
            <button onClick={() => setEditing(true)}
              className="px-5 py-2.5 bg-indigo-600 dark:bg-white text-white dark:text-black font-bold rounded-xl text-[11px] uppercase tracking-widest shadow-lg hover:opacity-90 transition-all active:scale-95 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">edit</span> Edit Profile
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => { setEditing(false); setForm({ full_name: profile?.full_name || '', occupation: profile?.occupation || '', date_of_birth: profile?.date_of_birth || '' }); }}
                className="px-5 py-2.5 bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-300 font-bold rounded-xl text-[11px] uppercase tracking-widest border border-zinc-200 dark:border-white/10 hover:bg-zinc-200 dark:hover:bg-white/10 transition-all">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-[11px] uppercase tracking-widest shadow-lg hover:bg-emerald-500 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2">
                {saving ? (<><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Saving...</>) : (<><span className="material-symbols-outlined text-[16px]">check</span> Save Changes</>)}
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ProfileField label="Full Name" value={profile?.full_name} editing={editing} inputValue={form.full_name} onChange={v => setForm({ ...form, full_name: v })} placeholder="Enter your full name" />
          <ProfileField label="Occupation" value={profile?.occupation} editing={editing} inputValue={form.occupation} onChange={v => setForm({ ...form, occupation: v })} placeholder="e.g. Software Engineer" />
          <ProfileField label="Email Address" value={profile?.email} locked icon="lock" />
          <ProfileField label="Date of Birth" value={formatDate(profile?.date_of_birth)} editing={editing} inputValue={form.date_of_birth} onChange={v => setForm({ ...form, date_of_birth: v })} placeholder="YYYY-MM-DD" type="date" />
        </div>
      </div>
    </div>
  );
}

function DetailCard({ label, value, icon, mono, onCopy }) {
  return (
    <div className="bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-2xl p-5 shadow-sm hover:border-indigo-500/20 transition-all group">
      <div className="flex justify-between items-start mb-3">
        <span className="text-[10px] uppercase font-black tracking-widest text-zinc-400">{label}</span>
        <span className="material-symbols-outlined text-zinc-300 dark:text-zinc-700 text-[18px] group-hover:text-indigo-500 transition-colors">{icon}</span>
      </div>
      <div className="flex items-center gap-2">
        <p className={`text-base font-bold tracking-tight text-zinc-900 dark:text-white truncate ${mono ? 'font-mono text-sm' : ''}`} title={value}>
          {value}
        </p>
        {onCopy && (
          <button onClick={onCopy} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-lg shrink-0">
            <span className="material-symbols-outlined text-zinc-400 text-[14px]">content_copy</span>
          </button>
        )}
      </div>
    </div>
  );
}

function SecurityCard({ icon, iconColor, title, description }) {
  const colors = {
    emerald: 'bg-emerald-500/10 text-emerald-500',
    indigo: 'bg-indigo-500/10 text-indigo-500',
    blue: 'bg-blue-500/10 text-blue-500',
    violet: 'bg-violet-500/10 text-violet-500',
    amber: 'bg-amber-500/10 text-amber-500',
  };
  return (
    <div className="p-5 border border-zinc-200 dark:border-white/5 rounded-2xl bg-zinc-50/50 dark:bg-white/[0.02] hover:border-indigo-500/20 transition-all group">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colors[iconColor]}`}>
          <span className={`material-symbols-outlined text-xl ${colors[iconColor]?.split(' ').pop()}`}>{icon}</span>
        </div>
        <span className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-tight">{title}</span>
      </div>
      <p className="text-[11px] text-zinc-500 font-medium leading-relaxed">{description}</p>
    </div>
  );
}

function ProfileField({ label, value, editing, inputValue, onChange, placeholder, type, locked, icon }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-1.5">
        {label}
        {locked && <span className="material-symbols-outlined text-[12px] text-zinc-300">{icon || 'lock'}</span>}
      </label>
      {editing && !locked ? (
        <input
          type={type || 'text'}
          value={inputValue}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all text-zinc-900 dark:text-white placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
        />
      ) : (
        <p className="text-sm font-bold text-zinc-900 dark:text-white py-3 px-1">{value || '—'}</p>
      )}
    </div>
  );
}
