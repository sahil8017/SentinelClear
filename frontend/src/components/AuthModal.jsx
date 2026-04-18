import React, { useState, useRef, useEffect, useCallback } from 'react';
import apiClient from '../lib/axios';

/**
 * Step-Up Authentication PIN Modal
 * 
 * Renders a premium dark-mode PIN input overlay that intercepts
 * deferred transfers requiring secondary verification.
 */
export function AuthModal({ transferId, onSuccess, onCancel }) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [pinLength, setPinLength] = useState(4); // 4 or 6
  const [error, setError] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    // Auto-focus first input on mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleDigitChange = useCallback((index, value) => {
    if (!/^\d?$/.test(value)) return; // Only digits

    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);
    setError(null);

    // Auto-advance to next input
    if (value && index < pinLength - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [digits, pinLength]);

  const handleKeyDown = useCallback((index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newDigits = [...digits];
      newDigits[index - 1] = '';
      setDigits(newDigits);
    }
    if (e.key === 'Enter') {
      handleSubmit();
    }
  }, [digits]);

  const handleSubmit = async () => {
    const pin = digits.slice(0, pinLength).join('');
    if (pin.length < pinLength) {
      setError(`Please enter all ${pinLength} digits`);
      triggerShake();
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const res = await apiClient.post(`/transfers/${transferId}/verify-auth`, { pin });
      onSuccess(res.data);
    } catch (err) {
      const detail = err.response?.data?.detail || 'Verification failed';
      setError(detail);
      triggerShake();
      // Clear PIN on failure
      setDigits(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 300);
    } finally {
      setIsVerifying(false);
    }
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const togglePinLength = () => {
    const newLen = pinLength === 4 ? 6 : 4;
    setPinLength(newLen);
    setDigits(['', '', '', '', '', '']);
    setError(null);
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  };

  const filledCount = digits.slice(0, pinLength).filter(d => d !== '').length;
  const progress = (filledCount / pinLength) * 100;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-xl"
        onClick={onCancel}
      />
      
      {/* Modal */}
      <div className={`relative w-full max-w-md mx-4 bg-zinc-950 border border-white/10 rounded-3xl shadow-2xl shadow-indigo-500/10 overflow-hidden transition-transform ${shake ? 'animate-shake' : ''}`}>
        {/* Progress bar */}
        <div className="h-1 bg-zinc-800">
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header */}
        <div className="p-8 pb-4 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl text-indigo-400">lock</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">Step-Up Verification</h2>
          <p className="text-sm text-zinc-400 mt-2">
            This transaction requires additional verification.
            <br />Enter your <span className="text-indigo-400 font-semibold">{pinLength}-digit</span> secure transaction PIN.
          </p>
        </div>

        {/* PIN Input Grid */}
        <div className="px-8 py-6">
          <div className="flex items-center justify-center gap-3">
            {Array.from({ length: pinLength }).map((_, i) => (
              <div key={i} className="relative">
                <input
                  ref={el => inputRefs.current[i] = el}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digits[i]}
                  onChange={e => handleDigitChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  className={`w-12 h-14 text-center text-xl font-mono font-bold rounded-xl border-2 outline-none transition-all duration-200
                    ${digits[i] 
                      ? 'bg-indigo-500/10 border-indigo-500/50 text-white shadow-lg shadow-indigo-500/20' 
                      : 'bg-zinc-900 border-zinc-700 text-zinc-500'}
                    focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 focus:bg-indigo-500/5
                    ${error ? 'border-red-500/50' : ''}`}
                  autoComplete="off"
                />
                {digits[i] && (
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                )}
              </div>
            ))}
          </div>

          {/* PIN Length Toggle */}
          <div className="flex justify-center mt-4">
            <button
              type="button"
              onClick={togglePinLength}
              className="text-[10px] uppercase tracking-widest text-zinc-500 hover:text-indigo-400 transition-colors font-bold"
            >
              Switch to {pinLength === 4 ? '6' : '4'}-digit PIN
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2">
              <span className="material-symbols-outlined text-red-400 text-lg">error</span>
              <span className="text-red-400 text-sm font-medium">{error}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-8 pt-2 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-4 rounded-xl border border-zinc-700 text-zinc-400 text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 hover:text-white transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isVerifying || filledCount < pinLength}
            className="flex-1 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold uppercase tracking-widest 
              hover:from-indigo-500 hover:to-violet-500 transition-all shadow-lg shadow-indigo-500/20
              disabled:opacity-40 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            {isVerifying ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">verified_user</span>
                Authorize
              </>
            )}
          </button>
        </div>

        {/* Security Notice */}
        <div className="px-8 pb-6">
          <div className="flex items-center gap-2 text-[10px] text-zinc-600">
            <span className="material-symbols-outlined text-[14px]">shield</span>
            <span>Encrypted channel • PIN verified server-side via bcrypt • Never stored in plaintext</span>
          </div>
        </div>
      </div>

      {/* Shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
          20%, 40%, 60%, 80% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: shake 0.6s cubic-bezier(.36,.07,.19,.97) both;
        }
      `}</style>
    </div>
  );
}
