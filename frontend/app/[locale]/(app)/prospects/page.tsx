"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, Search } from "lucide-react";

import { MatchLevelBadge } from "@/components/pipeline/MatchLevelBadge";
import { ApiError } from "@/lib/api-client/client";
import { getAllProspects, type ProspectWithContext } from "@/lib/api-client/pipeline";
import { useAuth } from "@/lib/auth/auth-context";
import { useTranslations } from "@/lib/i18n/I18nProvider";

export default function ProspectsPage() {
  const { t, locale } = useTranslations();
  const { token } = useAuth();

  const [prospects, setProspects] = useState<ProspectWithContext[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getAllProspects(token)
      .then((data) => {
        if (!cancelled) setProspects(data.sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0)));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : t("errors.generic"));
      });
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  const filtered = (prospects ?? []).filter((p) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return p.company_name.toLowerCase().includes(q) || p.product_name.toLowerCase().includes(q);
  });

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-xl2 border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{error}</p>
      </div>
    );
  }

  if (prospects === null) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-deep-navy/40 dark:text-warm-white/40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-deep-navy dark:text-warm-white">{t("nav.prospects")}</h2>
        <p className="mt-1 text-sm text-deep-navy/60 dark:text-warm-white/60">
          {t("prospectsList.subtitle", { count: String(prospects.length) })}
        </p>
      </div>

      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-deep-navy/40 dark:text-warm-white/40" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("prospectsList.searchPlaceholder")}
          aria-label={t("prospectsList.searchPlaceholder")}
          className="h-10 w-full rounded-lg border border-soft-gray bg-surface-white ps-9 pe-3 text-sm text-deep-navy placeholder:text-deep-navy/40 focus:outline-none focus:ring-2 focus:ring-primary-blue dark:border-white/10 dark:bg-white/5 dark:text-warm-white dark:placeholder:text-warm-white/40"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-soft-gray p-10 text-center text-sm text-deep-navy/60 dark:border-white/10 dark:text-warm-white/60">
          {t("prospectsList.empty")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl2 border border-soft-gray dark:border-white/10">
          <table className="w-full min-w-[640px] text-start text-sm">
            <thead className="bg-soft-gray text-xs uppercase tracking-wide text-deep-navy/60 dark:bg-white/5 dark:text-warm-white/60">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t("table.company")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("prospectsList.product")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("table.fitScore")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("table.matchLevel")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-soft-gray dark:divide-white/10">
              {filtered.map((prospect) => (
                <tr key={prospect.id} className="text-deep-navy dark:text-warm-white">
                  <td className="max-w-xs px-4 py-3">
                    <Link
                      href={`/${locale}/prospects/${prospect.id}`}
                      className="font-medium hover:text-primary-blue hover:underline"
                    >
                      {prospect.company_name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-deep-navy/70 dark:text-warm-white/70">
                    <Link href={`/${locale}/products/${prospect.product_id}`} className="hover:underline">
                      {prospect.product_name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                    {prospect.fit_score !== null ? prospect.fit_score.toFixed(2) : "--"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <MatchLevelBadge level={prospect.match_level} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
