"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Users,
  Mail,
  Settings,
  X,
} from "lucide-react";

import { useTranslations } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils/cn";

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const { t, locale } = useTranslations();
  const pathname = usePathname();

  const navItems = [
    { href: `/${locale}/dashboard`, label: t("nav.dashboard"), icon: LayoutDashboard },
    { href: `/${locale}/products`, label: t("nav.myProducts"), icon: Package },
    { href: `/${locale}/prospects`, label: t("nav.prospects"), icon: Users },
    { href: `/${locale}/messages`, label: t("nav.messages"), icon: Mail },
    { href: `/${locale}/settings`, label: t("nav.settings"), icon: Settings },
  ];

  const content = (
    <div className="flex h-full flex-col bg-deep-navy text-warm-white">
      <div className="flex items-center justify-between px-5 py-6">
        <Link href={`/${locale}/dashboard`} className="text-xl font-semibold">
          {t("app.name")}
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded p-1 hover:bg-white/10 md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-primary-blue text-deep-navy" : "text-warm-white/80 hover:bg-white/10"
              )}
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 md:block">{content}</aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
          <div className="absolute inset-y-0 start-0 w-72">{content}</div>
        </div>
      )}
    </>
  );
}
