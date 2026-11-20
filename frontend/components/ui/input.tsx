import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-lg border bg-surface-white px-3 text-sm text-deep-navy placeholder:text-deep-navy/40",
          "dark:bg-white/5 dark:text-warm-white dark:placeholder:text-warm-white/40",
          "focus:outline-none focus:ring-2 focus:ring-primary-blue",
          error ? "border-red-500" : "border-soft-gray dark:border-white/10",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
