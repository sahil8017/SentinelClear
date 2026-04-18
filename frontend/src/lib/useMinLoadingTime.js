import { useState, useEffect, useRef } from 'react';

/**
 * Returns true for at least `minMs` milliseconds even if `isLoading` goes false sooner.
 * This ensures skeleton screens are visible long enough to avoid jarring flickers.
 */
export function useMinLoadingTime(isLoading, minMs = 1200) {
  const [showLoading, setShowLoading] = useState(true);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (isLoading) {
      startRef.current = Date.now();
      setShowLoading(true);
    } else {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, minMs - elapsed);
      const timer = setTimeout(() => setShowLoading(false), remaining);
      return () => clearTimeout(timer);
    }
  }, [isLoading, minMs]);

  return showLoading;
}
