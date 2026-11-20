"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, Plus } from "lucide-react";

import { ProductsTable } from "@/components/pipeline/ProductsTable";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client/client";
import { getProducts, type Product } from "@/lib/api-client/pipeline";
import { useAuth } from "@/lib/auth/auth-context";
import { useTranslations } from "@/lib/i18n/I18nProvider";

export default function ProductsPage() {
  const { t, locale } = useTranslations();
  const { token } = useAuth();

  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getProducts(token)
      .then((data) => {
        if (!cancelled) setProducts(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : t("errors.generic"));
      });
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-deep-navy dark:text-warm-white">
          {t("dashboard.yourProducts")}
        </h2>
        <Link href={`/${locale}/products/new`}>
          <Button size="sm">
            <Plus className="h-4 w-4" />
            {t("dashboard.addNewProduct")}
          </Button>
        </Link>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl2 border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {!error && products === null && (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-deep-navy/40 dark:text-warm-white/40" />
        </div>
      )}

      {products !== null && products.length === 0 && (
        <div className="rounded-xl2 border border-dashed border-soft-gray p-10 text-center dark:border-white/10">
          <p className="text-sm text-deep-navy/60 dark:text-warm-white/60">{t("products.empty")}</p>
          <Link href={`/${locale}/products/new`} className="mt-4 inline-block">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              {t("dashboard.addNewProduct")}
            </Button>
          </Link>
        </div>
      )}

      {products !== null && products.length > 0 && <ProductsTable products={products} />}
    </div>
  );
}
