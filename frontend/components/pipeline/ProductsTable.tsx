"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type { Product } from "@/lib/api-client/pipeline";

function formatDate(iso?: string) {
  if (!iso) return "--";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export function ProductsTable({ products }: { products: Product[] }) {
  const { t, locale } = useTranslations();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.product_name.toLowerCase().includes(q));
  }, [products, query]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-deep-navy/40 dark:text-warm-white/40" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("dashboard.searchPlaceholder")}
            aria-label={t("dashboard.searchPlaceholder")}
            className="h-10 w-full rounded-lg border border-soft-gray bg-surface-white ps-9 pe-3 text-sm text-deep-navy placeholder:text-deep-navy/40 focus:outline-none focus:ring-2 focus:ring-primary-blue dark:border-white/10 dark:bg-white/5 dark:text-warm-white dark:placeholder:text-warm-white/40"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-soft-gray p-10 text-center text-sm text-deep-navy/60 dark:border-white/10 dark:text-warm-white/60">
          {t("table.noResults")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl2 border border-soft-gray dark:border-white/10">
          <table className="w-full min-w-[640px] text-start text-sm">
            <thead className="bg-soft-gray text-xs uppercase tracking-wide text-deep-navy/60 dark:bg-white/5 dark:text-warm-white/60">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t("table.productName")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("table.senderCompany")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("table.created")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("table.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-soft-gray dark:divide-white/10">
              {filtered.map((product) => (
                <tr key={product.id} className="text-deep-navy dark:text-warm-white">
                  <td className="max-w-xs px-4 py-3 font-medium">{product.product_name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-deep-navy/70 dark:text-warm-white/70">
                    {product.sender_company_name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-deep-navy/70 dark:text-warm-white/70">
                    {formatDate(product.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link href={`/${locale}/products/${product.id}`}>
                      <Button variant="outline" size="sm">
                        {t("table.view")}
                      </Button>
                    </Link>
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
