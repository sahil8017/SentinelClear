import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../lib/axios';

const USERNAME_REGEX = /^[A-Za-z0-9_-]{3,}$/;
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
      newErrors.username = "Username must be alphanumeric (min 3 chars).";
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
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f6f9fc] text-[#425466] p-4 sm:p-6 lg:p-8">
      {/* Subtle Stripe Grid Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ backgroundImage: 'radial-gradient(#e3e8ee 1px, transparent 1px)', backgroundSize: '32px 32px', opacity: 0.5 }}></div>

      <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-white border border-[#e3e8ee] shadow-sm rounded-xl flex items-center justify-center mx-auto mb-6">
             <span className="material-symbols-outlined text-[#635BFF] text-[24px]">account_tree</span>
          </div>
          <h1 className="text-2xl font-light text-[#0A2540] tracking-tight mb-2">Create your account</h1>
          <p className="text-[14px] text-[#6B7C93] font-medium">Join the SentinelClear transaction network.</p>
        </div>

        <div className="bg-white border border-[#e3e8ee] rounded-xl p-6 sm:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] space-y-6">
          <form onSubmit={handleRegister} className="space-y-4">
            
            <div className="space-y-1.5">
              <label htmlFor="register-username" className="text-[12px] font-semibold text-[#0A2540] ml-1">Username</label>
              <input 
                id="register-username"
                type="text" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                placeholder="BusinessName"
                aria-invalid={!!errors.username}
                className={`w-full bg-[#f6f9fc] hover:bg-white border ${errors.username ? 'border-[#df1b41]' : 'border-[#e3e8ee]'} rounded-md px-3 py-2 text-[14px] outline-none focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/20 transition-all placeholder:text-[#6B7C93]/50 text-[#0A2540]`} 
              />
              {errors.username && <p id="register-username-error" className="text-[#df1b41] text-[11px] font-medium ml-1 mt-1">{errors.username}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="register-email" className="text-[12px] font-semibold text-[#0A2540] ml-1">Email address</label>
              <input 
                id="register-email"
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
                placeholder="name@company.com"
                className="w-full bg-[#f6f9fc] hover:bg-white border border-[#e3e8ee] rounded-md px-3 py-2 text-[14px] outline-none focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/20 transition-all placeholder:text-[#6B7C93]/50 text-[#0A2540]" 
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="register-password" className="text-[12px] font-semibold text-[#0A2540] ml-1">Password</label>
              <input 
                id="register-password"
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="••••••••"
                aria-invalid={!!errors.password}
                className={`w-full bg-[#f6f9fc] hover:bg-white border ${errors.password ? 'border-[#df1b41]' : 'border-[#e3e8ee]'} rounded-md px-3 py-2 text-[14px] outline-none focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/20 transition-all placeholder:text-[#6B7C93]/50 text-[#0A2540]`} 
              />
              {errors.password && <p id="register-password-error" className="text-[#df1b41] text-[11px] font-medium ml-1 mt-1">{errors.password}</p>}
            </div>

            {serverError && (
              <p className="text-[#df1b41] text-[13px] font-medium mt-2 p-3 bg-[#fff5f5] rounded-md border border-[#ffcdcd]">{serverError}</p>
            )}

            <button 
              type="submit"
              disabled={isLoading || !username || !email || !password}
              className="w-full py-2.5 mt-2 bg-[#635BFF] text-white font-medium rounded-md text-[14px] transition-all hover:bg-[#5851db] shadow-[0_2px_5px_rgba(99,91,255,0.3)] active:scale-[0.98] disabled:opacity-50"
            >
              {isLoading ? 'Creating account...' : 'Continue'}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-[14px] text-[#6B7C93]">
          Already have an account? <Link to="/login" className="text-[#635BFF] font-medium hover:text-[#5851db] hover:underline transition-colors">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
