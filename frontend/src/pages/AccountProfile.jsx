import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../lib/axios';
import { toast } from 'sonner';
import { formatINR } from '../lib/format';
import { useMinLoadingTime } from '../lib/useMinLoadingTime';
import { Skeleton } from '../components/ui/Skeleton';

// ── Parse a rough device name from userAgent ──────────────────────────────────
const parseDevice = (ua) => {
  if (!ua) return { name: 'Unknown Device', browser: 'Unknown' };
  let browser = 'Browser';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';
  let device = 'Desktop';
  if (/Android|iPhone|iPad|Mobile/i.test(ua)) device = /iPad/i.test(ua) ? 'iPad' : 'Mobile';
  return { name: `${device} · ${browser}`, browser };
};

const getBrowserIcon = (browser) => {
  const icons = { Chrome: 'public', Firefox: 'public', Safari: 'public', Edge: 'public' };
  return icons[browser] || 'computer';
};

// ── Register or refresh current device in localStorage ────────────────────────
const registerCurrentDevice = () => {
  try {
    const devices = JSON.parse(localStorage.getItem('recognized_devices') || '[]');
    const ua = navigator.userAgent;
    const { name, browser } = parseDevice(ua);
    const sessionId = btoa(ua).substring(0, 24); // stable ID for this UA
    const now = new Date().toISOString();
    const existing = devices.find(d => d.id === sessionId);
    if (existing) {
      existing.last_seen = now;
      existing.is_current = true;
    } else {
      devices.forEach(d => { d.is_current = false; });
      devices.unshift({ id: sessionId, name, browser, last_seen: now, is_current: true });
    }
    localStorage.setItem('recognized_devices', JSON.stringify(devices.slice(0, 10)));
    return devices;
  } catch { return []; }
};

export function AccountProfile() {
  const [account, setAccount] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: '', occupation: '', date_of_birth: '' });
  const [devices, setDevices] = useState([]);

  const showSkeleton = useMinLoadingTime(isLoading, 1200);

  useEffect(() => {
    // Register current device on mount
    const registered = registerCurrentDevice();
    setDevices(registered);
  }, []);

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
      <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-pulse px-4 md:px-0">
        <div className="space-y-3">
          <Skeleton className="w-56 h-10 rounded" />
          <Skeleton className="w-96 h-4 rounded" />
        </div>
        <div className="bg-white border border-[#e3e8ee] rounded-[16px] p-8">
          <div className="flex items-center gap-5 mb-8">
            <Skeleton className="w-16 h-16 rounded-[12px]" />
            <div className="flex-1 space-y-2"><Skeleton className="w-48 h-6 rounded" /><Skeleton className="w-32 h-3 rounded" /></div>
            <Skeleton className="w-40 h-8 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="bg-white border border-[#e3e8ee] rounded-[12px] p-6">
              <Skeleton className="w-24 h-3 mb-4 rounded" /><Skeleton className="w-3/4 h-5 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 fade-in duration-500 pb-20 px-4 md:px-0">
      {/* Page Header */}
      <div>
        <h1 className="text-[32px] md:text-[40px] font-light tracking-tight text-[#0A2540] m-0">Account Profile</h1>
        <p className="text-[14px] text-[#425466] mt-2 max-w-lg leading-[1.6]">
          Manage your identity, view account details, and configure security settings.
        </p>
      </div>

      {/* Identity Card */}
      <div className="bg-white border border-[#e3e8ee] rounded-[16px] p-6 md:p-8 shadow-[0_2px_5px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#635BFF] rounded-[12px] flex items-center justify-center shadow-[0_2px_8px_rgba(99,91,255,0.3)] shrink-0">
              <span className="material-symbols-outlined text-white text-[28px]">person</span>
            </div>
            <div>
              <h2 className="text-[22px] font-medium tracking-tight text-[#0A2540]">
                {profile?.full_name || profile?.username || 'User'}
              </h2>
              <p className="text-[14px] text-[#6B7C93] mt-0.5">{profile?.email || '—'}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                  profile?.role === 'ADMIN' 
                    ? 'bg-[#fff5f2] text-[#ff6118] border-[#ffe0d4]'
                    : 'bg-[#f0eeff] text-[#635BFF] border-[#635BFF]/20'
                }`}>
                  {profile?.role || 'USER'}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                  profile?.profile_complete
                    ? 'bg-[#e7f9ed] text-[#0CBF4C] border-[#0CBF4C]/20'
                    : 'bg-[#f6f9fc] text-[#6B7C93] border-[#e3e8ee]'
                }`}>
                  {profile?.profile_complete ? '✓ Complete' : 'Incomplete'}
                </span>
              </div>
            </div>
          </div>
          <div className="text-left md:text-right">
            <p className="text-[11px] uppercase font-bold tracking-wider text-[#6B7C93] mb-1">Available Balance</p>
            <p className="text-[28px] font-light tracking-tight text-[#0A2540] font-mono">
              {account ? formatINR(account.balance) : '—'}
            </p>
            <p className="text-[11px] uppercase font-medium tracking-wider text-[#6B7C93] mt-1">
              {account?.account_type?.toUpperCase() || 'SAVINGS'} Account
            </p>
          </div>
        </div>
      </div>

      {/* Account Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <DetailCard label="Account ID" value={account?.id || '—'} icon="fingerprint" mono onCopy={account?.id ? () => copyText(account.id) : undefined} />
        <DetailCard label="Username" value={profile?.username || '—'} icon="alternate_email" />
        <DetailCard label="Email" value={profile?.email || '—'} icon="mail" />
        <DetailCard label="Date of Birth" value={formatDate(profile?.date_of_birth)} icon="cake" />
        <DetailCard label="Member Since" value={profile?.created_at ? formatDateTime(profile.created_at) : '—'} icon="calendar_month" />
        <DetailCard label="Trusted Person" value={profile?.trusted_person_username || 'Not Set'} icon="supervised_user_circle" />
      </div>

      {/* Editable Profile */}
      <div className="bg-white border border-[#e3e8ee] rounded-[16px] p-6 md:p-8 shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 border-b border-[#e3e8ee] pb-5 gap-4">
          <div>
            <h3 className="text-[16px] font-medium text-[#0A2540]">Personal Information</h3>
            <p className="text-[12px] text-[#6B7C93] mt-1">Update your profile details below</p>
          </div>
          {!editing ? (
            <button onClick={() => setEditing(true)}
              className="px-5 py-2.5 bg-[#635BFF] hover:bg-[#5851db] text-white font-medium rounded-[8px] text-[13px] shadow-[0_2px_5px_rgba(99,91,255,0.3)] transition-all active:scale-95 flex items-center gap-2 min-h-[44px]">
              <span className="material-symbols-outlined text-[16px]">edit</span> Edit Profile
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => { setEditing(false); setForm({ full_name: profile?.full_name || '', occupation: profile?.occupation || '', date_of_birth: profile?.date_of_birth || '' }); }}
                className="px-5 py-2.5 bg-white border border-[#e3e8ee] text-[#425466] font-medium rounded-[8px] text-[13px] hover:bg-[#f6f9fc] transition-all min-h-[44px]">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2.5 bg-[#0A2540] hover:bg-[#112F4E] text-white font-medium rounded-[8px] text-[13px] transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 min-h-[44px]">
                {saving ? (<><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Saving...</>) : (<><span className="material-symbols-outlined text-[16px]">check</span> Save</>)}
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

      {/* Recognized Devices */}
      <div className="bg-white border border-[#e3e8ee] rounded-[16px] p-6 md:p-8 shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
        <div className="flex items-start justify-between mb-6 border-b border-[#e3e8ee] pb-5">
          <div>
            <h3 className="text-[16px] font-medium text-[#0A2540]">Recognized Devices</h3>
            <p className="text-[12px] text-[#6B7C93] mt-1">Browsers and devices where you’ve signed in recently.</p>
          </div>
          <span className="material-symbols-outlined text-[#6B7C93] text-[22px]">devices</span>
        </div>

        {devices.length === 0 ? (
          <div className="py-8 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 bg-[#f6f9fc] border border-[#e3e8ee] rounded-[10px] flex items-center justify-center">
              <span className="material-symbols-outlined text-[#6B7C93] text-[24px]">devices</span>
            </div>
            <div>
              <p className="text-[13px] font-medium text-[#0A2540]">No other devices recognized</p>
              <p className="text-[12px] text-[#6B7C93] mt-1">You’re only signed in here.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {devices.map((device, i) => (
              <div key={device.id || i} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-[#f6f9fc] border border-[#e3e8ee] rounded-[10px] gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-[8px] flex items-center justify-center shrink-0 ${
                    device.is_current ? 'bg-[#635BFF]/10 border border-[#635BFF]/20' : 'bg-white border border-[#e3e8ee]'
                  }`}>
                    <span className={`material-symbols-outlined text-[20px] ${device.is_current ? 'text-[#635BFF]' : 'text-[#6B7C93]'}`}>
                      {getBrowserIcon(device.browser)}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[14px] font-medium text-[#0A2540]">{device.name}</p>
                      {device.is_current && (
                        <span className="px-2 py-0.5 bg-[#635BFF]/10 text-[#635BFF] border border-[#635BFF]/20 rounded text-[9px] font-bold uppercase tracking-wider">CURRENT</span>
                      )}
                    </div>
                    <p className="text-[12px] text-[#6B7C93] mt-0.5">
                      Last seen: {device.last_seen ? new Date(device.last_seen).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Unknown'}
                    </p>
                  </div>
                </div>
                {!device.is_current && (
                  <button
                    onClick={() => {
                      const updated = devices.filter(d => d.id !== device.id);
                      localStorage.setItem('recognized_devices', JSON.stringify(updated));
                      setDevices(updated);
                      toast.success('Device removed');
                    }}
                    className="px-3 py-2 bg-white border border-[#e3e8ee] hover:border-[#ffcdcd] hover:bg-[#fff5f5] text-[#6B7C93] hover:text-[#df1b41] rounded-[6px] text-[12px] font-medium transition-all flex items-center gap-1.5 min-h-[36px] shrink-0"
                  >
                    <span className="material-symbols-outlined text-[14px]">delete</span> Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailCard({ label, value, icon, mono, onCopy }) {
  return (
    <div className="bg-white border border-[#e3e8ee] rounded-[12px] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-[0_5px_15px_rgba(0,0,0,0.04)] transition-all group">
      <div className="flex justify-between items-start mb-3">
        <span className="text-[11px] uppercase font-bold tracking-wider text-[#6B7C93]">{label}</span>
        <span className="material-symbols-outlined text-[#e3e8ee] text-[18px] group-hover:text-[#635BFF] transition-colors">{icon}</span>
      </div>
      <div className="flex items-center gap-2">
        <p className={`text-[14px] font-medium text-[#0A2540] truncate ${mono ? 'font-mono text-[13px]' : ''}`} title={value}>
          {value}
        </p>
        {onCopy && (
          <button onClick={onCopy} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-[#f6f9fc] rounded shrink-0">
            <span className="material-symbols-outlined text-[#6B7C93] text-[14px]">content_copy</span>
          </button>
        )}
      </div>
    </div>
  );
}

function ProfileField({ label, value, editing, inputValue, onChange, placeholder, type, locked, icon }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[12px] font-medium text-[#0A2540] flex items-center gap-1.5">
        {label}
        {locked && <span className="material-symbols-outlined text-[12px] text-[#6B7C93]">{icon || 'lock'}</span>}
      </label>
      {editing && !locked ? (
        <input
          type={type || 'text'}
          value={inputValue}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-[#f6f9fc] focus:bg-white border border-[#e3e8ee] rounded-[8px] px-4 py-3 text-[14px] outline-none focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/20 transition-all text-[#0A2540]"
        />
      ) : (
        <p className="text-[14px] font-medium text-[#0A2540] py-3 px-1">{value || '—'}</p>
      )}
    </div>
  );
}
