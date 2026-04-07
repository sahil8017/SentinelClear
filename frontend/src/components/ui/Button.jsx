import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

const Button = React.forwardRef(({ className, variant = 'primary', size = 'default', isLoading, children, ...props }, ref) => {
  const baseStyles = "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40";
  const variants = {
    primary: "bg-primary text-white hover:bg-primary-hover rounded-md",
    success: "bg-success/12 text-success border border-success/20 hover:bg-success/20 rounded-md",
    danger: "bg-danger/12 text-danger border border-danger/20 hover:bg-danger/20 rounded-md",
    warning: "bg-warning/12 text-warning border border-warning/20 hover:bg-warning/20 rounded-md",
    outline: "bg-[rgba(255,255,255,0.06)] text-textMain border border-border hover:bg-[rgba(255,255,255,0.1)] rounded-md",
    ghost: "bg-transparent text-muted hover:bg-[rgba(255,255,255,0.06)] hover:text-textMain rounded-md",
  };
  const sizes = {
    default: "h-7 px-3 text-base",
    sm: "h-6 px-2 text-sm",
    lg: "h-8 px-4 text-base",
    icon: "h-7 w-7",
  };

  return (
    <button
      ref={ref}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
      disabled={isLoading || props.disabled}
    >
      {isLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
});
Button.displayName = 'Button';
export { Button };
