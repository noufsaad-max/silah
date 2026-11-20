"use client";

import { Bell, Menu, Search } from "lucide-react";

import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

interface TopNavigationProps {
  title: string;
  onOpenMobileMenu: () => void;
}

export function TopNavigation({ title, onOpenMobileMenu }: TopNavigationProps) {
  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-soft-gray bg-surface-white px-4 dark:border-white/10 dark:bg-dark-navy md:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open menu"
          className="rounded-lg p-2 hover:bg-soft-gray dark:hover:bg-white/5 md:hidden"
        >
          <Menu className="h-5 w-5 text-deep-navy dark:text-warm-white" />
        </button>
        <h1 className="text-lg font-semibold text-deep-navy dark:text-warm-white">{title}</h1>
      </div>

      <div className="hidden max-w-md flex-1 items-center gap-2 rounded-lg border border-soft-gray px-3 py-2 dark:border-white/10 md:flex">
        <Search className="h-4 w-4 text-deep-navy/50 dark:text-warm-white/50" aria-hidden="true" />
        <input
          type="search"
          placeholder="Search"
          aria-label="Search"
          className="w-full bg-transparent text-sm text-deep-navy placeholder:text-deep-navy/40 focus:outline-none dark:text-warm-white dark:placeholder:text-warm-white/40"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Notifications"
          className="relative rounded-lg p-2 hover:bg-soft-gray dark:hover:bg-white/5"
        >
          <Bell className="h-5 w-5 text-deep-navy dark:text-warm-white" />
          <span className="absolute end-1.5 top-1.5 h-2 w-2 rounded-full bg-turquoise" />
        </button>
        <ThemeToggle />
        <LanguageSwitcher />
        <UserMenu />
      </div>
    </header>
  );
}
