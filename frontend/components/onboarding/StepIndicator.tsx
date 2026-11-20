"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils/cn";

interface Step {
  label: string;
}

export function StepIndicator({
  steps,
  currentStep,
  onStepClick,
}: {
  steps: Step[];
  currentStep: number;
  onStepClick?: (index: number) => void;
}) {
  return (
    <nav aria-label="Onboarding steps" className="space-y-1">
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isComplete = index < currentStep;
        const clickable = onStepClick && index <= currentStep;
        return (
          <button
            key={step.label}
            type="button"
            disabled={!clickable}
            onClick={() => onStepClick?.(index)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start text-sm font-medium transition-colors",
              isActive
                ? "bg-primary-blue text-deep-navy"
                : isComplete
                  ? "text-deep-navy dark:text-warm-white"
                  : "text-deep-navy/40 dark:text-warm-white/40",
              clickable && !isActive && "hover:bg-soft-gray dark:hover:bg-white/5"
            )}
            aria-current={isActive ? "step" : undefined}
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs",
                isActive
                  ? "border-deep-navy bg-deep-navy text-warm-white"
                  : isComplete
                    ? "border-turquoise bg-turquoise text-deep-navy"
                    : "border-current"
              )}
            >
              {isComplete ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            {step.label}
          </button>
        );
      })}
    </nav>
  );
}
