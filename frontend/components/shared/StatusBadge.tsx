import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type { ProductStatus } from "@/types";

const toneByStatus: Record<ProductStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  draft: "neutral",
  analyzing: "info",
  in_progress: "info",
  active: "success",
  completed: "success",
  needs_review: "warning",
  archived: "neutral",
};

export function StatusBadge({ status }: { status: ProductStatus }) {
  const { t } = useTranslations();
  return <Badge tone={toneByStatus[status]}>{t(`status.${status}`)}</Badge>;
}
