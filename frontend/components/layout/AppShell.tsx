"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth/auth-context";
import { useTranslations } from "@/lib/i18n/I18nProvider";

import { Sidebar } from "./Sidebar";
import { TopNavigation } from "./TopNavigation";

export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  const { isAuthenticated, isHydrated } = useAuth();
  const { locale } = useTranslations();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.replace(`/${locale}/login`);
    }
  }, [isHydrated, isAuthenticated, locale, router]);

  if (!isHydrated || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-soft-gray dark:bg-deep-navy">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-blue border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-soft-gray dark:bg-deep-navy">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNavigation title={title} onOpenMobileMenu={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
