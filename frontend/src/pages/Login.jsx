import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { setToken, getRoleFromToken } from '../lib/auth';
import apiClient from '../lib/axios';
import { signInWithGoogle } from '../lib/firebase';

export function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/login', { username: email, password });
      const internalToken = response.data.access_token;
      if (internalToken) {
        setToken(internalToken);
        const role = getRoleFromToken();
        if (role === 'ADMIN') {
          navigate('/admin/ops');
        } else {
          navigate('/app/dashboard');
        }
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithGoogle();
      if (!result || !result.idToken) {
        // Result is often null if user closes the popup early
        throw new Error("Authentication cancelled by user.");
      }
      const { idToken } = result;
      const response = await apiClient.post('/auth/firebase-login', { token: idToken });
      const internalToken = response.data.access_token;
      if (internalToken) {
        setToken(internalToken);
        const role = getRoleFromToken();
        if (role === 'ADMIN') {
          navigate('/admin/ops');
        } else {
          navigate('/app/dashboard');
        }
      }
    } catch (err) {
      // Gracefully catch cross-origin / popup closure errors
      const msg = err.message || "Google authentication failed.";
      if (msg.includes("popup-closed-by-user") || msg.includes("cancelled")) {
        setError("Sign-in cancelled. Please keep the popup open.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#08090A] text-white p-6">
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full"></div>
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center mb-10">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(255,255,255,0.1)]">
             <span className="material-symbols-outlined text-black text-[24px]">security</span>
          </div>
          <h1 className="text-3xl font-black tracking-tighter mb-2">Welcome back.</h1>
          <p className="text-zinc-500 text-sm font-medium">Access your SentinelClear terminal.</p>
        </div>

        <div className="bg-[#121315] border border-white/5 rounded-3xl p-8 shadow-2xl space-y-6">
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500 ml-1">Username or Email</label>
              <input 
                type="text" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@company.com"
                className="w-full bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500/50 transition-colors placeholder:text-zinc-700"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500 ml-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500/50 transition-colors placeholder:text-zinc-700"
              />
            </div>

            {error && (
              <p className="text-red-500 text-[12px] font-bold text-center animate-in shake duration-300">{error}</p>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 bg-white text-black font-bold rounded-xl text-sm transition-all hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <div className="relative flex items-center justify-center py-2">
            <div className="absolute w-full border-t border-white/5"></div>
            <span className="relative bg-[#121315] px-4 text-[10px] font-black uppercase tracking-widest text-zinc-600">OR</span>
          </div>

          <button 
            onClick={handleGoogleLogin} 
            disabled={loading}
            className="w-full py-3 bg-white/[0.03] border border-white/10 rounded-xl text-sm font-bold flex items-center justify-center gap-3 transition-colors hover:bg-white/10 active:scale-[0.98] disabled:opacity-50"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            Continue with Google
          </button>
        </div>

        <p className="text-center mt-8 text-sm text-zinc-500">
          Don't have an account? <Link to="/register" className="text-white font-bold hover:underline">Get started for free</Link>
        </p>
      </div>
    </div>
  );
}
