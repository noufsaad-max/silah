import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type { OutreachStatus } from "@/lib/api-client/pipeline";

const toneByStatus: Record<OutreachStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  not_sent: "neutral",
  draft: "info",
  approved: "info",
  sent: "success",
  failed: "danger",
  replied: "success",
  not_interested: "neutral",
  meeting_requested: "success",
};

export function OutreachStatusBadge({ status }: { status: OutreachStatus }) {
  const { t } = useTranslations();
  return <Badge tone={toneByStatus[status]}>{t(`outreachStatus.${status}`)}</Badge>;
}
