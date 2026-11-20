"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";

import { OutreachStatusBadge } from "@/components/pipeline/OutreachStatusBadge";
import { ApiError } from "@/lib/api-client/client";
import { getAllOutreach, type OutreachStatus, type OutreachWithContext } from "@/lib/api-client/pipeline";
import { useAuth } from "@/lib/auth/auth-context";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils/cn";

const TABS: Array<{ key: "all" | OutreachStatus }> = [
  { key: "all" },
  { key: "draft" },
  { key: "approved" },
  { key: "sent" },
  { key: "replied" },
  { key: "meeting_requested" },
  { key: "not_interested" },
  { key: "failed" },
  { key: "not_sent" },
];

function formatDate(iso?: string | null) {
  if (!iso) return "--";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function MessagesPage() {
  const { t, locale } = useTranslations();
  const { token } = useAuth();

  const [rows, setRows] = useState<OutreachWithContext[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | OutreachStatus>("all");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getAllOutreach(token)
      .then((data) => {
        if (!cancelled) {
          setRows(
            data.sort(
              (a, b) =>
                new Date(b.sent_at ?? b.created_at ?? 0).getTime() -
                new Date(a.sent_at ?? a.created_at ?? 0).getTime()
            )
          );
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : t("errors.generic"));
      });
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows?.length ?? 0 };
    for (const row of rows ?? []) {
      c[row.status] = (c[row.status] ?? 0) + 1;
    }
    return c;
  }, [rows]);

  const filtered = (rows ?? []).filter((r) => activeTab === "all" || r.status === activeTab);

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-xl2 border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{error}</p>
      </div>
    );
  }

  if (rows === null) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-deep-navy/40 dark:text-warm-white/40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-deep-navy dark:text-warm-white">{t("nav.messages")}</h2>
        <p className="mt-1 text-sm text-deep-navy/60 dark:text-warm-white/60">
          {t("messages.subtitle", { count: String(rows.length) })}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition",
              activeTab === tab.key
                ? "border-primary-blue bg-primary-blue text-white"
                : "border-soft-gray text-deep-navy/70 hover:bg-soft-gray dark:border-white/10 dark:text-warm-white/70 dark:hover:bg-white/5"
            )}
          >
            {tab.key === "all" ? t("messages.tabAll") : t(`outreachStatus.${tab.key}`)}
            <span className="ms-1 opacity-70">({counts[tab.key] ?? 0})</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-soft-gray p-10 text-center text-sm text-deep-navy/60 dark:border-white/10 dark:text-warm-white/60">
          {t("messages.empty")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl2 border border-soft-gray dark:border-white/10">
          <table className="w-full min-w-[720px] text-start text-sm">
            <thead className="bg-soft-gray text-xs uppercase tracking-wide text-deep-navy/60 dark:bg-white/5 dark:text-warm-white/60">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t("table.company")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("prospectsList.product")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("messages.subject")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("table.outreachStatus")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("messages.lastUpdated")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-soft-gray dark:divide-white/10">
              {filtered.map((row) => (
                <tr key={row.id} className="text-deep-navy dark:text-warm-white">
                  <td className="max-w-xs px-4 py-3">
                    <Link
                      href={`/${locale}/prospects/${row.prospect_id}`}
                      className="font-medium hover:text-primary-blue hover:underline"
                    >
                      {row.company_name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-deep-navy/70 dark:text-warm-white/70">
                    <Link href={`/${locale}/products/${row.product_id}`} className="hover:underline">
                      {row.product_name}
                    </Link>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-deep-navy/70 dark:text-warm-white/70">
                    {row.email_subject ?? t("messages.noSubject")}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <OutreachStatusBadge status={row.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-deep-navy/60 dark:text-warm-white/60">
                    {formatDate(row.sent_at ?? row.created_at)}
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
