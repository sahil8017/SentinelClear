import React from 'react';
import { cn } from '../../lib/utils';

function Badge({ className, variant = "default", ...props }) {
  const variants = {
    default: "bg-[rgba(255,255,255,0.06)] text-muted",
    primary: "bg-primary-dim text-primary",
    success: "bg-success-dim text-success",
    warning: "bg-warning-dim text-warning",
    danger: "bg-danger-dim text-danger",
  };

  return (
    <div className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", variants[variant], className)} {...props} />
  );
}
export { Badge };
