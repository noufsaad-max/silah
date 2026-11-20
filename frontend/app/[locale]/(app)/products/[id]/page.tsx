"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Building2, Loader2, Mail, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api-client/client";
import { getProduct, getRunsForProduct, type Product, type Run } from "@/lib/api-client/pipeline";
import { useAuth } from "@/lib/auth/auth-context";
import { useTranslations } from "@/lib/i18n/I18nProvider";

function formatDate(iso?: string) {
  if (!iso) return "--";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const { t, locale } = useTranslations();
  const { token } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    Promise.all([getProduct(token, params.id), getRunsForProduct(token, params.id)])
      .then(([productData, runsData]) => {
        if (cancelled) return;
        setProduct(productData);
        setRuns(runsData);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : t("errors.generic"));
      });
    return () => {
      cancelled = true;
    };
  }, [token, params.id, t]);

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-xl2 border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{error}</p>
      </div>
    );
  }

  if (!product || !runs) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-deep-navy/40 dark:text-warm-white/40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{product.product_name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-deep-navy/70 dark:text-warm-white/70">{product.product_description}</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-deep-navy/60 dark:text-warm-white/60">
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="h-[18px] w-[18px]" /> {product.sender_company_name}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-[18px] w-[18px]" /> {product.sender_email}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-[18px] w-[18px]" /> {product.sender_phone}
            </span>
          </div>
        </CardContent>
      </Card>

      <div>
        <h3 className="mb-3 text-base font-semibold text-deep-navy dark:text-warm-white">
          {t("productDetail.runsTitle")}
        </h3>

        {runs.length === 0 ? (
          <div className="rounded-xl2 border border-dashed border-soft-gray p-8 text-center text-sm text-deep-navy/60 dark:border-white/10 dark:text-warm-white/60">
            {t("productDetail.noRuns")}
          </div>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => (
              <Card key={run.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-deep-navy dark:text-warm-white">
                      {run.preferred_city
                        ? t("productDetail.runCity", { city: run.preferred_city })
                        : t("productDetail.runAnyCity")}
                    </p>
                    <p className="mt-0.5 text-xs text-deep-navy/60 dark:text-warm-white/60">
                      {t("productDetail.runMeta", {
                        count: String(run.requested_company_count ?? "--"),
                        date: formatDate(run.created_at),
                      })}
                    </p>
                  </div>
                  <Link href={`/${locale}/products/${product.id}/results?run=${run.id}`}>
                    <Button variant="outline" size="sm">
                      {t("productDetail.viewResults")}
                      <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
