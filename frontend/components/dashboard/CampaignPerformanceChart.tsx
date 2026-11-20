"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type { CampaignPerformancePoint } from "@/types";

export function CampaignPerformanceChart({ data }: { data: CampaignPerformancePoint[] }) {
  const { t } = useTranslations();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.campaignPerformance")}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Accessible fallback: the chart is decorative/summarizing; the same
            series are also available in the products table below, so screen
            reader users aren't dependent on this visualization alone. */}
        <div role="img" aria-label="Line chart of emails sent, responses, and interested prospects over time">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.5} />
              <YAxis tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.5} />
              <Tooltip
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="emailsSent" name="Emails sent" stroke="#122A52" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="responses" name="Responses" stroke="#16C8B5" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="interested" name="Interested" stroke="#C7A66A" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
