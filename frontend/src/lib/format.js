/**
 * Global Formatting Utility for SentinelClear (Indian Standard)
 */

/**
 * Formats a number to Indian Rupee (INR) string.
 * @param {number} amount - The numeric value.
 * @param {boolean} detailed - If true, shows full precision (2 decimal places). 
 *                             If false, shows a concise version for high volumes.
 */
export function formatINR(amount, detailed = false) {
  if (amount === undefined || amount === null) return '₹0.00';

  if (!detailed) {
    if (amount >= 10000000) { // 1 Crore
      return `₹${(amount / 10000000).toFixed(2)}Cr`;
    }
    if (amount >= 100000) { // 1 Lakh
      return `₹${(amount / 100000).toFixed(2)}L`;
    }
    if (amount >= 1000) {
      return `₹${(amount / 1000).toFixed(1)}K`;
    }
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats a date string/object to Indian Standard Time (IST).
 */
export function formatIST(date, options = {}) {
  if (!date) return '—';
  
  const defaultOptions = {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    ...options
  };

  return new Date(date).toLocaleString('en-IN', defaultOptions);
}

/**
 * Extracts only the 24-hour IST hour from a date.
 */
export function getISTHour(date) {
  const d = date instanceof Date ? date : new Date(date);
  return parseInt(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    hour12: false
  }).format(d));
}
