"use client";

import { useRouter, usePathname } from "next/navigation";
import { Globe } from "lucide-react";

import { locales, localeLabels, type Locale } from "@/lib/i18n/config";
import { useTranslations } from "@/lib/i18n/I18nProvider";

export function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useTranslations();

  function switchTo(next: Locale) {
    if (next === locale) return;
    const segments = pathname.split("/");
    segments[1] = next; // [locale] is always the first path segment
    router.push(segments.join("/") || "/");
  }

  return (
    <div className="relative inline-flex items-center gap-1 rounded-lg border border-soft-gray px-2 py-1.5 text-sm dark:border-white/10">
      <Globe className="h-4 w-4 text-deep-navy/60 dark:text-warm-white/60" aria-hidden="true" />
      <select
        aria-label="Language"
        value={locale}
        onChange={(e) => switchTo(e.target.value as Locale)}
        className="cursor-pointer appearance-none bg-transparent pr-1 text-deep-navy focus:outline-none dark:text-warm-white"
      >
        {locales.map((l) => (
          <option key={l} value={l} className="text-deep-navy">
            {localeLabels[l]}
          </option>
        ))}
      </select>
    </div>
  );
}
