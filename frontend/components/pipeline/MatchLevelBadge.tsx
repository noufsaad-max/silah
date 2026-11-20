import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type { MatchLevel } from "@/lib/api-client/pipeline";

const toneByLevel: Record<MatchLevel, "success" | "warning" | "neutral"> = {
  "high match": "success",
  "medium match": "warning",
  "low match": "neutral",
};

export function MatchLevelBadge({ level }: { level: MatchLevel | null }) {
  const { t } = useTranslations();
  if (!level) return <Badge tone="neutral">{t("matchLevel.unscored")}</Badge>;
  return <Badge tone={toneByLevel[level]}>{t(`matchLevel.${level.replace(" ", "_")}`)}</Badge>;
}
