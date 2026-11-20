import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";

export function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "neutral" | "accent" | "warning";
}) {
  const iconBg =
    tone === "accent"
      ? "bg-turquoise/15 text-turquoise"
      : tone === "warning"
        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
        : "bg-primary-blue/20 text-royal-navy dark:text-primary-blue";

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-deep-navy/60 dark:text-warm-white/60">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-deep-navy dark:text-warm-white">{value}</p>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
    </Card>
  );
}
