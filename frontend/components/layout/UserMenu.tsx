"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, LogOut } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-context";
import { useTranslations } from "@/lib/i18n/I18nProvider";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

export function UserMenu() {
  const { user, workspace, logout } = useAuth();
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-soft-gray dark:hover:bg-white/5"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-blue text-sm font-semibold text-deep-navy">
          {initialsFromName(user.name)}
        </span>
        <span className="hidden text-start sm:block">
          <span className="block text-sm font-medium text-deep-navy dark:text-warm-white">{user.name}</span>
          <span className="block text-xs text-deep-navy/60 dark:text-warm-white/60">{workspace?.name}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-deep-navy/50 dark:text-warm-white/50" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute end-0 z-20 mt-2 w-48 rounded-lg border border-soft-gray bg-surface-white py-1 shadow-lg dark:border-white/10 dark:bg-dark-navy"
        >
          <button
            role="menuitem"
            onClick={logout}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-deep-navy hover:bg-soft-gray dark:text-warm-white dark:hover:bg-white/5"
          >
            <LogOut className="h-4 w-4" />
            {t("nav.signOut")}
          </button>
        </div>
      )}
    </div>
  );
}
