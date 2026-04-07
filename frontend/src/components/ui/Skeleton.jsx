import React from 'react';

/**
 * Reusable Skeleton loader utilizing Tailwind's animate-pulse.
 * Beautifully adapts to light and dark modes.
 */
export function Skeleton({ className = '', style }) {
  return (
    <div 
      className={`animate-pulse bg-zinc-200 dark:bg-[#1C1D21] rounded-lg ${className}`}
      style={style}
    />
  );
}
