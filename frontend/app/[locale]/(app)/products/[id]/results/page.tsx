"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, Loader2, Mail, Sparkles } from "lucide-react";

import { MatchLevelBadge } from "@/components/pipeline/MatchLevelBadge";
import { OutreachStatusBadge } from "@/components/pipeline/OutreachStatusBadge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client/client";
import {
  draftOutreach,
  getProduct,
  getProspectsWithOutreachForRun,
  type Product,
  type ProspectWithOutreach,
} from "@/lib/api-client/pipeline";
import { useAuth } from "@/lib/auth/auth-context";
import { useRealAgentsPreference } from "@/lib/hooks/useRealAgentsPreference";
import { useTranslations } from "@/lib/i18n/I18nProvider";

export default function ProductResultsPage({ params }: { params: { id: string } }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-deep-navy/40 dark:text-warm-white/40" />
        </div>
      }
    >
      <ProductResultsContent params={params} />
    </Suspense>
  );
}

function ProductResultsContent({ params }: { params: { id: string } }) {
  const { t, locale } = useTranslations();
  const { token } = useAuth();
  const searchParams = useSearchParams();
  const runId = searchParams.get("run");

  const [product, setProduct] = useState<Product | null>(null);
  const [prospects, setProspects] = useState<ProspectWithOutreach[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [useRealAgents, setUseRealAgents] = useRealAgentsPreference();

  useEffect(() => {
    if (!token || !runId) return;
    let cancelled = false;
    Promise.all([getProduct(token, params.id), getProspectsWithOutreachForRun(token, runId)])
      .then(([productData, prospectsData]) => {
        if (cancelled) return;
        setProduct(productData);
        setProspects(prospectsData.sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0)));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : t("errors.generic"));
      });
    return () => {
      cancelled = true;
    };
  }, [token, runId, params.id, t]);

  async function handleDraft(prospect: ProspectWithOutreach) {
    if (!token || !product) return;
    setDraftingId(prospect.id);
    setRowError(null);
    try {
      const outreach = await draftOutreach(token, prospect.id, {
        product_name: product.product_name,
        sender: {
          name: product.sender_name,
          company_name: product.sender_company_name,
          email: product.sender_email,
          phone: product.sender_phone,
        },
      }, useRealAgents);
      setProspects((prev) =>
        prev
          ? prev.map((p) =>
              p.id === prospect.id
                ? { ...p, outreach_id: outreach.id, outreach_status: outreach.status, email_subject: outreach.email_subject }
                : p
            )
          : prev
      );
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : t("errors.generic"));
    } finally {
      setDraftingId(null);
    }
  }

  if (!runId) {
    return (
      <div className="flex items-start gap-3 rounded-xl2 border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{t("results.noRunSelected")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-xl2 border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{error}</p>
      </div>
    );
  }

  if (!product || prospects === null) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-deep-navy/40 dark:text-warm-white/40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-deep-navy dark:text-warm-white">
          {t("results.title", { product: product.product_name })}
        </h2>
        <p className="mt-1 text-sm text-deep-navy/60 dark:text-warm-white/60">
          {t("results.subtitle", { count: String(prospects.length) })}
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-deep-navy/70 dark:text-warm-white/70">
        <input
          type="checkbox"
          checked={useRealAgents}
          onChange={(e) => setUseRealAgents(e.target.checked)}
          className="h-4 w-4 rounded border-soft-gray text-primary-blue focus:ring-primary-blue dark:border-white/20"
        />
        {t("newProduct.useRealAgents")}
      </label>

      {rowError && (
        <div className="flex items-start gap-3 rounded-xl2 border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{rowError}</p>
        </div>
      )}

      {prospects.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-soft-gray p-10 text-center text-sm text-deep-navy/60 dark:border-white/10 dark:text-warm-white/60">
          {t("results.empty")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl2 border border-soft-gray dark:border-white/10">
          <table className="w-full min-w-[820px] text-start text-sm">
            <thead className="bg-soft-gray text-xs uppercase tracking-wide text-deep-navy/60 dark:bg-white/5 dark:text-warm-white/60">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t("table.company")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("table.fitScore")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("table.matchLevel")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("table.outreachStatus")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("table.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-soft-gray dark:divide-white/10">
              {prospects.map((prospect) => (
                <tr key={prospect.id} className="text-deep-navy dark:text-warm-white">
                  <td className="max-w-xs px-4 py-3">
                    <Link
                      href={`/${locale}/prospects/${prospect.id}`}
                      className="font-medium hover:text-primary-blue hover:underline"
                    >
                      {prospect.company_name}
                    </Link>
                    {prospect.company_email && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-deep-navy/50 dark:text-warm-white/50">
                        <Mail className="h-3 w-3" /> {prospect.company_email}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                    {prospect.fit_score !== null ? prospect.fit_score.toFixed(2) : "--"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <MatchLevelBadge level={prospect.match_level} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <OutreachStatusBadge status={prospect.outreach_status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {prospect.outreach_status === "not_sent" ? (
                      <div>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={draftingId === prospect.id || !prospect.company_email}
                          onClick={() => handleDraft(prospect)}
                          title={!prospect.company_email ? t("results.noEmailOnFile") : undefined}
                        >
                          {draftingId === prospect.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                          {t("results.draftOutreach")}
                        </Button>
                        {!prospect.company_email && (
                          <p className="mt-1 text-xs text-deep-navy/50 dark:text-warm-white/50">
                            {t("results.noEmailOnFile")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <Link href={`/${locale}/prospects/${prospect.id}`}>
                        <Button variant="outline" size="sm">
                          {t("table.view")}
                          <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                        </Button>
                      </Link>
                    )}
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
