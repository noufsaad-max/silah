"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Box, CheckCircle2, Loader2, Plus, Send, TrendingUp, Users } from "lucide-react";
import Link from "next/link";

import { CampaignPerformanceChart } from "@/components/dashboard/CampaignPerformanceChart";
import { ConversionFunnel } from "@/components/dashboard/ConversionFunnel";
import { RecentActivityPanel } from "@/components/dashboard/RecentActivityPanel";
import { ProductsTable } from "@/components/pipeline/ProductsTable";
import { MetricCard } from "@/components/shared/MetricCard";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client/client";
import {
  getAllOutreach,
  getAllProspects,
  getProducts,
  type OutreachWithContext,
  type Product,
  type ProspectWithContext,
} from "@/lib/api-client/pipeline";
import { useAuth } from "@/lib/auth/auth-context";
import { computeDailySeries, computeFunnel, computeKpis, computeRecentActivity } from "@/lib/dashboard-metrics";
import { useTranslations } from "@/lib/i18n/I18nProvider";

export default function DashboardPage() {
  const { t, locale } = useTranslations();
  const { user, token } = useAuth();

  const [products, setProducts] = useState<Product[] | null>(null);
  const [prospects, setProspects] = useState<ProspectWithContext[] | null>(null);
  const [outreach, setOutreach] = useState<OutreachWithContext[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    Promise.all([getProducts(token), getAllProspects(token), getAllOutreach(token)])
      .then(([productsData, prospectsData, outreachData]) => {
        if (cancelled) return;
        setProducts(productsData);
        setProspects(prospectsData);
        setOutreach(outreachData);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : t("errors.generic"));
      });
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  const loading = products === null || prospects === null || outreach === null;
  const kpis = loading ? null : computeKpis(products, prospects, outreach);
  const funnel = loading
    ? []
    : computeFunnel(outreach).map((stage) => ({ label: t(`dashboard.funnel.${stage.key}`), value: stage.value }));
  const dailySeries = loading ? [] : computeDailySeries(outreach);
  const recentActivity = loading ? [] : computeRecentActivity(outreach);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-deep-navy/60 dark:text-warm-white/60">
          {t("dashboard.welcome")}, {user?.name.split(" ")[0]}!
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl2 border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {!error && loading && (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-deep-navy/40 dark:text-warm-white/40" />
        </div>
      )}

      {!error && kpis && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label={t("dashboard.kpi.totalProducts")} value={kpis.totalProducts} icon={Box} />
            <MetricCard
              label={t("dashboard.kpi.totalEmailsSent")}
              value={kpis.totalEmailsSent}
              icon={Send}
              tone="accent"
            />
            <MetricCard label={t("dashboard.kpi.responses")} value={kpis.responses} icon={Users} />
            <MetricCard
              label={t("dashboard.kpi.conversionRate")}
              value={`${kpis.conversionRate}%`}
              icon={TrendingUp}
              tone="accent"
            />
            <MetricCard
              label={t("dashboard.kpi.companiesAnalyzed")}
              value={kpis.companiesAnalyzed}
              icon={CheckCircle2}
            />
            <MetricCard
              label={t("dashboard.kpi.interestedProspects")}
              value={kpis.interestedProspects}
              icon={Users}
              tone="accent"
            />
            <MetricCard
              label={t("dashboard.kpi.itemsNeedingReview")}
              value={kpis.itemsNeedingReview}
              icon={AlertCircle}
              tone="warning"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <CampaignPerformanceChart data={dailySeries} />
            </div>
            <ConversionFunnel stages={funnel} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-xl2 border border-soft-gray bg-surface-white p-5 dark:border-white/10 dark:bg-dark-navy lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-deep-navy dark:text-warm-white">
                  {t("dashboard.yourProducts")}
                </h2>
                <Link href={`/${locale}/products/new`}>
                  <Button size="sm">
                    <Plus className="h-4 w-4" />
                    {t("dashboard.addNewProduct")}
                  </Button>
                </Link>
              </div>
              {products && products.length > 0 ? (
                <ProductsTable products={products} />
              ) : (
                <div className="rounded-xl2 border border-dashed border-soft-gray p-8 text-center dark:border-white/10">
                  <p className="text-sm text-deep-navy/60 dark:text-warm-white/60">{t("products.empty")}</p>
                  <Link href={`/${locale}/products/new`} className="mt-4 inline-block">
                    <Button size="sm">
                      <Plus className="h-4 w-4" />
                      {t("dashboard.addNewProduct")}
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            <RecentActivityPanel items={recentActivity} />
          </div>
        </>
      )}
    </div>
  );
}
