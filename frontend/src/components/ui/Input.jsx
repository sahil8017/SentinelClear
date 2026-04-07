import React from 'react';
import { cn } from '../../lib/utils';

const Input = React.forwardRef(({ className, type = 'text', error, ...props }, ref) => {
  const describedBy = error && props.id ? `${props.id}-error` : undefined;

  return (
    <div className="w-full">
      <input
        type={type}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className={cn(
          "flex h-[30px] w-full rounded-md bg-card px-3 text-base text-textMain placeholder:text-tertiary focus:outline-none transition-colors",
          error
            ? "border border-danger focus:border-danger"
            : "border border-[rgba(255,255,255,0.1)] focus:border-primary",
          className
        )}
        ref={ref}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
});
Input.displayName = "Input";
export { Input };
