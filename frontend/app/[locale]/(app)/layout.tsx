"use client";

import { usePathname } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { useTranslations } from "@/lib/i18n/I18nProvider";

const titleKeyByPath: Record<string, string> = {
  dashboard: "dashboard.title",
  products: "nav.myProducts",
  prospects: "nav.prospects",
  messages: "nav.messages",
  settings: "nav.settings",
};

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslations();
  const pathname = usePathname();
  const section = pathname.split("/")[2] ?? "dashboard";
  const titleKey = titleKeyByPath[section] ?? "dashboard.title";

  return <AppShell title={t(titleKey)}>{children}</AppShell>;
}
