import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../lib/axios';

const USERNAME_REGEX = /^[A-Za-z0-9_-]{3,}$/;// Simple alphanumeric + underscores/hyphens
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const navigate = useNavigate();

  const validate = () => {
    const newErrors = {};
    if (!USERNAME_REGEX.test(username)) {
      newErrors.username = "Username must include upper, lower, number, and special character.";
    }
    if (!PASSWORD_REGEX.test(password)) {
      newErrors.password = "Min 8 chars, including upper, lower, number, and special character.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    setIsLoading(true);
    try {
      await apiClient.post('/auth/register', { username, email, password });
      navigate('/login');
    } catch (err) {
      setServerError(err.response?.data?.detail || 'Registration failed. Technical conflict detected.');
    } finally {
      setIsLoading(false);
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
             <span className="material-symbols-outlined text-black text-[24px]">account_tree</span>
          </div>
          <h1 className="text-3xl font-black tracking-tighter mb-2">Create an account.</h1>
          <p className="text-zinc-500 text-sm font-medium">Join the SentinelClear transaction network.</p>
        </div>

        <div className="bg-[#121315] border border-white/5 rounded-3xl p-8 shadow-2xl space-y-6">
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="register-username" className="text-[11px] font-black uppercase tracking-widest text-zinc-500 ml-1">Username</label>
              <input 
                id="register-username"
                type="text" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                placeholder="User_Name1!"
                aria-invalid={!!errors.username}
                className={`w-full bg-white/[0.03] border ${errors.username ? 'border-red-500/50' : 'border-white/5'} rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500/50 transition-colors placeholder:text-zinc-700`} 
              />
              {errors.username && <p id="register-username-error" className="text-red-500 text-[10px] font-bold ml-1">{errors.username}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="register-email" className="text-[11px] font-black uppercase tracking-widest text-zinc-500 ml-1">Email Address</label>
              <input 
                id="register-email"
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
                placeholder="name@company.com"
                className="w-full bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500/50 transition-colors placeholder:text-zinc-700" 
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="register-password" className="text-[11px] font-black uppercase tracking-widest text-zinc-500 ml-1">Password</label>
              <input 
                id="register-password"
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="••••••••"
                aria-invalid={!!errors.password}
                className={`w-full bg-white/[0.03] border ${errors.password ? 'border-red-500/50' : 'border-white/5'} rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500/50 transition-colors placeholder:text-zinc-700`} 
              />
              {errors.password && <p id="register-password-error" className="text-red-500 text-[10px] font-bold ml-1">{errors.password}</p>}
            </div>

            {serverError && (
              <p className="text-red-500 text-[12px] font-bold text-center">{serverError}</p>
            )}

            <button 
              type="submit"
              disabled={isLoading || !username || !email || !password}
              className="w-full py-4 bg-white text-black font-bold rounded-xl text-sm transition-all hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-50"
            >
              {isLoading ? 'Creating Account...' : 'Get Started'}
            </button>
          </form>
        </div>

        <p className="text-center mt-8 text-sm text-zinc-500">
          Already have an account? <Link to="/login" className="text-white font-bold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
