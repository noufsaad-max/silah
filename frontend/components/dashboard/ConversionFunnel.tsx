"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type { FunnelStage } from "@/types";

export function ConversionFunnel({ stages }: { stages: FunnelStage[] }) {
  const { t } = useTranslations();
  const max = Math.max(...stages.map((s) => s.value), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.conversionFunnel")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {stages.map((stage) => {
          const widthPct = Math.max((stage.value / max) * 100, 8);
          return (
            <div key={stage.label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-deep-navy dark:text-warm-white">{stage.label}</span>
                <span className="font-medium text-deep-navy dark:text-warm-white">{stage.value}</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-soft-gray dark:bg-white/10">
                <div
                  className="h-2.5 rounded-full bg-turquoise"
                  style={{ width: `${widthPct}%` }}
                  role="progressbar"
                  aria-valuenow={stage.value}
                  aria-valuemin={0}
                  aria-valuemax={max}
                  aria-label={stage.label}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
