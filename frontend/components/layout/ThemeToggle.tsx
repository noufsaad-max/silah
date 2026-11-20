"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/lib/theme/theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={toggleTheme}
      className="relative inline-flex h-8 w-14 items-center rounded-full border border-soft-gray bg-soft-gray transition-colors dark:border-white/10 dark:bg-white/10"
    >
      <span
        className={`inline-flex h-6 w-6 transform items-center justify-center rounded-full bg-surface-white shadow transition-transform dark:bg-dark-navy ${
          isDark ? "translate-x-7 rtl:-translate-x-7" : "translate-x-1 rtl:-translate-x-1"
        }`}
      >
        {isDark ? <Moon className="h-3.5 w-3.5 text-primary-blue" /> : <Sun className="h-3.5 w-3.5 text-gold" />}
      </span>
    </button>
  );
}
