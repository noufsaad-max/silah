import { forwardRef } from "react";
import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "min-h-[100px] w-full rounded-lg border bg-surface-white px-3 py-2 text-sm text-deep-navy placeholder:text-deep-navy/40",
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
Textarea.displayName = "Textarea";
