import React from 'react';

/**
 * Reusable Skeleton loader utilizing Tailwind's animate-pulse.
 * Beautifully adapts to light and dark modes.
 */
export function Skeleton({ className = '', style }) {
  return (
    <div 
      className={`animate-pulse bg-[#e3e8ee] rounded-lg ${className}`}
      style={style}
    />
  );
}
