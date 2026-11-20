"use client";

import { AlertTriangle, CheckCircle2, Mail, MessageSquareReply, PenLine, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OutreachStatus } from "@/lib/api-client/pipeline";
import type { RecentActivityItem } from "@/lib/dashboard-metrics";
import { useTranslations } from "@/lib/i18n/I18nProvider";

const iconByStatus: Record<OutreachStatus, LucideIcon> = {
  not_sent: Mail,
  draft: PenLine,
  approved: CheckCircle2,
  sent: Mail,
  failed: AlertTriangle,
  replied: MessageSquareReply,
  not_interested: XCircle,
  meeting_requested: MessageSquareReply,
};

function timeAgo(iso: string | null) {
  if (!iso) return "--";
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function RecentActivityPanel({ items }: { items: RecentActivityItem[] }) {
  const { t } = useTranslations();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.recentActivity")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 pt-4">
        {items.length === 0 ? (
          <p className="py-4 text-sm text-deep-navy/50 dark:text-warm-white/50">{t("dashboard.noRecentActivity")}</p>
        ) : (
          items.map((item) => {
            const Icon = iconByStatus[item.status];
            return (
              <div key={item.id} className="flex items-start gap-3 py-2">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-soft-gray text-deep-navy dark:bg-white/10 dark:text-warm-white">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-deep-navy dark:text-warm-white">
                    {t(`dashboard.activity.${item.status}`, { company: item.companyName })}
                  </p>
                  <p className="text-xs text-deep-navy/50 dark:text-warm-white/50">{timeAgo(item.timestamp)}</p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
