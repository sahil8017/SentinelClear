import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { setToken, getRoleFromToken } from '../lib/auth';
import apiClient from '../lib/axios';

export function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [googleAuthEnabled, setGoogleAuthEnabled] = useState(false);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    import('../lib/firebase').then((m) => {
      m.firebaseReady.then(() => setGoogleAuthEnabled(m.firebaseEnabled));
    });
  }, []);

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
          try {
            const profRes = await apiClient.get('/auth/profile');
            if (!profRes.data.profile_complete) {
              navigate('/app/profile-setup');
              return;
            }
          } catch {}
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
      const { firebaseReady, signInWithGoogle } = await import('../lib/firebase');
      await firebaseReady;
      const result = await signInWithGoogle();
      if (!result || !result.idToken) {
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
          try {
            const profRes = await apiClient.get('/auth/profile');
            if (!profRes.data.profile_complete) {
              navigate('/app/profile-setup');
              return;
            }
          } catch {}
          navigate('/app/dashboard');
        }
      }
    } catch (err) {
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
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f6f9fc] text-[#425466] p-4 sm:p-6 lg:p-8">
      {/* Subtle Stripe Grid Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ backgroundImage: 'radial-gradient(#e3e8ee 1px, transparent 1px)', backgroundSize: '32px 32px', opacity: 0.5 }}></div>

      <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-white border border-[#e3e8ee] shadow-sm rounded-xl flex items-center justify-center mx-auto mb-6">
             <span className="material-symbols-outlined text-[#635BFF] text-[24px]">security</span>
          </div>
          <h1 className="text-2xl font-light text-[#0A2540] tracking-tight mb-2">Sign in to your account</h1>
          <p className="text-[14px] text-[#6B7C93] font-medium">Access the Sentinel Manager terminal.</p>
          <Link to="/" className="inline-flex items-center gap-1 mt-3 text-[13px] text-[#635BFF] font-medium hover:text-[#5851db] transition-colors group">
            <span className="material-symbols-outlined text-[16px] group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
            Back to Home
          </Link>
        </div>

        <div className="bg-white border border-[#e3e8ee] rounded-xl p-6 sm:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] space-y-6">
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-[#0A2540] ml-1">Email address</label>
              <input 
                type="text" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@company.com"
                className="w-full bg-[#f6f9fc] hover:bg-white border border-[#e3e8ee] rounded-md px-3 py-2 text-[14px] outline-none focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/20 transition-all placeholder:text-[#6B7C93]/50 text-[#0A2540]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-[#0A2540] ml-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-[#f6f9fc] hover:bg-white border border-[#e3e8ee] rounded-md px-3 py-2 text-[14px] outline-none focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/20 transition-all placeholder:text-[#6B7C93]/50 text-[#0A2540]"
              />
            </div>

            {error && (
              <p className="text-[#df1b41] text-[13px] font-medium mt-2 mb-2 p-3 bg-[#fff5f5] rounded-md border border-[#ffcdcd] animate-in shake duration-300">
                {error}
              </p>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-2.5 mt-2 bg-[#635BFF] text-white font-medium rounded-md text-[14px] transition-all hover:bg-[#5851db] shadow-[0_2px_5px_rgba(99,91,255,0.3)] active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign in'}
            </button>
          </form>

          {googleAuthEnabled && (
            <>
              <div className="relative flex items-center justify-center py-2">
                <div className="absolute w-full border-t border-[#e3e8ee]"></div>
                <span className="relative bg-white px-4 text-[12px] font-medium text-[#6B7C93]">or continue with</span>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-2.5 bg-white border border-[#e3e8ee] rounded-md text-[14px] font-medium text-[#0A2540] flex items-center justify-center gap-3 transition-colors hover:bg-[#f6f9fc] shadow-[0_1px_2px_rgba(0,0,0,0.02)] active:scale-[0.98] disabled:opacity-50"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 pointer-events-none" />
                Google
              </button>
            </>
          )}
        </div>

        <p className="text-center mt-6 text-[14px] text-[#6B7C93]">
          Don't have an account? <Link to="/register" className="text-[#635BFF] font-medium hover:text-[#5851db] hover:underline transition-colors">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
