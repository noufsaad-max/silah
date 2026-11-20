import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-primary-blue text-deep-navy hover:opacity-90 focus-visible:ring-primary-blue disabled:opacity-50",
  secondary:
    "bg-royal-navy text-warm-white hover:bg-royal-navy/90 focus-visible:ring-royal-navy disabled:opacity-50",
  outline:
    "border border-soft-gray text-deep-navy dark:text-warm-white dark:border-white/20 hover:bg-soft-gray dark:hover:bg-white/5",
  ghost: "text-deep-navy dark:text-warm-white hover:bg-soft-gray dark:hover:bg-white/5",
};

const sizeStyles: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          "disabled:pointer-events-none",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
