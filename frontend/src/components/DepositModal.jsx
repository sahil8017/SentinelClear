import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import apiClient from '../lib/axios';

/* ─── Indian Banking Payment Method Limits ─── */
const PAYMENT_METHODS = [
  { key: 'UPI',  label: 'UPI',  maxLabel: 'Max ₹1,00,000',  max: 100000, min: 1 },
  { key: 'IMPS', label: 'IMPS', maxLabel: 'Max ₹10,00,000', max: 1000000, min: 1 },
  { key: 'RTGS', label: 'RTGS', maxLabel: 'Min ₹2,00,000',  max: Infinity, min: 200000 },
];

const PAN_THRESHOLD = 50000;

/* ─── Currency Formatter (Indian locale) ─── */
function fmtINR(val) {
  if (!val && val !== 0) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(val);
}

/**
 * DepositModal — Stripe-styled deposit form conforming to Indian banking regulations.
 *
 * Props:
 *   open       : boolean — whether the modal is visible
 *   onClose    : () => void
 *   onSuccess  : () => void — called after a successful deposit to refresh data
 *   balance    : number — current account balance (for ledger preview)
 */
export default function DepositModal({ open, onClose, onSuccess, balance = 0 }) {
  const [rawAmount, setRawAmount] = useState('');
  const [method, setMethod] = useState('IMPS');
  const [submitting, setSubmitting] = useState(false);

  const amount = parseFloat(rawAmount) || 0;
  const selectedMethod = PAYMENT_METHODS.find(m => m.key === method);

  /* ─── Validation ─── */
  const limitError = useMemo(() => {
    if (amount <= 0) return null;
    if (method === 'UPI' && amount > 100000)
      return 'UPI transactions are limited to ₹1,00,000 per RBI guidelines.';
    if (method === 'RTGS' && amount < 200000)
      return 'RTGS requires a minimum of ₹2,00,000 as per RBI norms.';
    if (method === 'IMPS' && amount > 1000000)
      return 'IMPS transactions are limited to ₹10,00,000 per transaction.';
    return null;
  }, [amount, method]);

  const showPanWarning = amount > PAN_THRESHOLD && !limitError;
  const canSubmit = amount > 0 && !limitError && !submitting;

  /* ─── Amount Input Handler (strip non-numeric except dot) ─── */
  const handleAmountChange = (e) => {
    const val = e.target.value.replace(/[^0-9.]/g, '');
    // Allow only one decimal point
    const parts = val.split('.');
    if (parts.length > 2) return;
    setRawAmount(val);
  };

  /* ─── Submit ─── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      await apiClient.post('/accounts/me/deposit', { amount });
      toast.success('Settlement Complete', {
        description: `${fmtINR(amount)} deposited via ${method}.`,
      });
      setRawAmount('');
      setMethod('IMPS');
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error('Deposit Failed', {
        description: err.response?.data?.detail || 'Could not finalize settlement.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      id="deposit-modal-overlay"
      className="fixed inset-0 bg-[#0A2540]/20 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={(e) => { if (e.target.id === 'deposit-modal-overlay') onClose?.(); }}
    >
      <div
        className="w-full max-w-md animate-in zoom-in-95 duration-200"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e3e8ee',
          borderRadius: '14px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        {/* ── Header ── */}
        <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid #e3e8ee' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#0A2540', margin: 0, letterSpacing: '-0.3px' }}>
                Deposit Funds
              </h3>
              <p style={{ fontSize: '13px', color: '#6B7C93', marginTop: '4px' }}>
                Add liquidity to your account ledger.
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#6B7C93', padding: '4px', borderRadius: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f6f9fc'; e.currentTarget.style.color = '#0A2540'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#6B7C93'; }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>close</span>
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px' }}>
          {/* Payment Method Selector */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#0A2540', marginBottom: '8px', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
              Payment Method
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {PAYMENT_METHODS.map(m => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMethod(m.key)}
                  style={{
                    flex: 1,
                    padding: '10px 8px',
                    border: method === m.key ? '2px solid #635BFF' : '1px solid #e3e8ee',
                    borderRadius: '10px',
                    backgroundColor: method === m.key ? '#f8f7ff' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'center',
                  }}
                >
                  <div style={{
                    fontSize: '14px', fontWeight: 600, letterSpacing: '0.5px',
                    color: method === m.key ? '#635BFF' : '#0A2540',
                  }}>
                    {m.label}
                  </div>
                  <div style={{
                    fontSize: '10px', fontWeight: 500, marginTop: '2px',
                    color: method === m.key ? '#635BFF' : '#6B7C93',
                  }}>
                    {m.maxLabel}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Amount Input */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#0A2540', marginBottom: '8px', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
              Amount (INR)
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                fontSize: '18px', fontWeight: 500, color: '#6B7C93', pointerEvents: 'none',
              }}>₹</span>
              <input
                id="deposit-amount-input"
                autoFocus
                type="text"
                inputMode="decimal"
                value={rawAmount}
                onChange={handleAmountChange}
                placeholder="0.00"
                style={{
                  width: '100%',
                  backgroundColor: '#f6f9fc',
                  border: limitError ? '1.5px solid #df1b41' : '1px solid #e3e8ee',
                  borderRadius: '10px',
                  padding: '14px 16px 14px 36px',
                  fontSize: '18px',
                  fontFamily: '"SF Mono", "Fira Code", "Fira Mono", monospace',
                  fontWeight: 500,
                  color: '#0A2540',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box',
                  /* Remove number input arrows via inline — also handled in CSS */
                  MozAppearance: 'textfield',
                }}
                onFocus={e => {
                  if (!limitError) {
                    e.target.style.borderColor = '#635BFF';
                    e.target.style.boxShadow = '0 0 0 3px rgba(99,91,255,0.15)';
                    e.target.style.backgroundColor = '#ffffff';
                  }
                }}
                onBlur={e => {
                  e.target.style.borderColor = limitError ? '#df1b41' : '#e3e8ee';
                  e.target.style.boxShadow = 'none';
                  e.target.style.backgroundColor = '#f6f9fc';
                }}
              />
            </div>
            {/* Formatted preview */}
            {amount > 0 && !limitError && (
              <div style={{ fontSize: '12px', color: '#6B7C93', marginTop: '6px', fontWeight: 500 }}>
                {fmtINR(amount)}
              </div>
            )}
          </div>

          {/* ── Limit Error Block ── */}
          {limitError && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              padding: '12px 14px',
              backgroundColor: '#fff5f5', border: '1px solid #ffcdcd', borderRadius: '10px',
              marginBottom: '16px',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#df1b41', marginTop: '1px' }}>error</span>
              <span style={{ fontSize: '13px', color: '#df1b41', fontWeight: 500, lineHeight: '1.45' }}>{limitError}</span>
            </div>
          )}

          {/* ── PAN Regulatory Warning ── */}
          {showPanWarning && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              padding: '12px 14px',
              backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px',
              marginBottom: '16px',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#d97706', marginTop: '1px' }}>warning</span>
              <span style={{ fontSize: '13px', color: '#92400e', fontWeight: 500, lineHeight: '1.45' }}>
                Regulatory Notice: PAN Card reporting required for transactions exceeding ₹50,000.
              </span>
            </div>
          )}

          {/* ── Info Strip ── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 14px',
            backgroundColor: '#f6f9fc', border: '1px solid #e3e8ee', borderRadius: '10px',
            marginBottom: '16px',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#635BFF' }}>info</span>
            <span style={{ fontSize: '12px', color: '#425466', fontWeight: 500 }}>
              Deposits via {method} settle instantly on your operational ledger.
            </span>
          </div>

          {/* ── Ledger Preview ── */}
          {amount > 0 && !limitError && (
            <div style={{
              padding: '14px 16px',
              background: 'linear-gradient(135deg, #f6f9fc 0%, #eef1f6 100%)',
              border: '1px solid #e3e8ee', borderRadius: '10px',
              marginBottom: '20px',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#6B7C93', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
                Ledger Preview
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#6B7C93', fontWeight: 500 }}>Current Balance</div>
                  <div style={{ fontSize: '18px', fontWeight: 300, color: '#0A2540', fontFamily: '"SF Mono", monospace', marginTop: '2px' }}>
                    {fmtINR(balance)}
                  </div>
                </div>
                <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#635BFF' }}>arrow_forward</span>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#6B7C93', fontWeight: 500 }}>Post-Deposit</div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: '#0CBF4C', fontFamily: '"SF Mono", monospace', marginTop: '2px' }}>
                    {fmtINR(balance + amount)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Submit Button ── */}
          <button
            id="deposit-submit-btn"
            type="submit"
            disabled={!canSubmit}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: canSubmit ? '#635BFF' : '#a5a3f7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              boxShadow: canSubmit ? '0 2px 8px rgba(99,91,255,0.35)' : 'none',
              letterSpacing: '0.2px',
            }}
            onMouseEnter={e => { if (canSubmit) e.currentTarget.style.backgroundColor = '#5851db'; }}
            onMouseLeave={e => { if (canSubmit) e.currentTarget.style.backgroundColor = '#635BFF'; }}
          >
            {submitting ? 'Processing…' : 'Finalize Deposit'}
          </button>
        </form>
      </div>
    </div>
  );
}
