"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Mail, Send, Sparkles, ThumbsUp } from "lucide-react";

import { MatchLevelBadge } from "@/components/pipeline/MatchLevelBadge";
import { OutreachStatusBadge } from "@/components/pipeline/OutreachStatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api-client/client";
import {
  approveOutreach,
  draftOutreach,
  getOutreachForProspect,
  getProspect,
  sendOutreach,
  type Outreach,
  type ProspectDetail,
} from "@/lib/api-client/pipeline";
import { useAuth } from "@/lib/auth/auth-context";
import { useRealAgentsPreference } from "@/lib/hooks/useRealAgentsPreference";
import { useTranslations } from "@/lib/i18n/I18nProvider";

function formatDate(iso?: string | null) {
  if (!iso) return "--";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function ProspectDetailPage({ params }: { params: { id: string } }) {
  const { t } = useTranslations();
  const { token } = useAuth();

  const [prospect, setProspect] = useState<ProspectDetail | null>(null);
  const [outreachHistory, setOutreachHistory] = useState<Outreach[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [useRealAgents, setUseRealAgents] = useRealAgentsPreference();

  function load() {
    if (!token) return;
    return Promise.all([getProspect(token, params.id), getOutreachForProspect(token, params.id)]).then(
      ([prospectData, outreachData]) => {
        setProspect(prospectData);
        setOutreachHistory(outreachData);
      }
    );
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    load()?.catch((err) => {
      if (!cancelled) setError(err instanceof ApiError ? err.message : t("errors.generic"));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, params.id]);

  const latest = outreachHistory && outreachHistory.length > 0 ? outreachHistory[0] : null;

  async function withAction(name: string, fn: () => Promise<unknown>) {
    setActionError(null);
    setPendingAction(name);
    try {
      await fn();
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("errors.generic"));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDraft() {
    if (!token || !prospect?.product) return;
    const product = prospect.product;
    await withAction("draft", () =>
      draftOutreach(token, prospect.id, {
        product_name: product.product_name,
        sender: {
          name: product.sender_name,
          company_name: product.sender_company_name,
          email: product.sender_email,
          phone: product.sender_phone,
        },
      }, useRealAgents)
    );
  }

  async function handleApprove() {
    if (!token || !latest) return;
    await withAction("approve", () => approveOutreach(token, latest.id));
  }

  async function handleSend() {
    if (!token || !latest) return;
    await withAction("send", () => sendOutreach(token, latest.id));
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-xl2 border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{error}</p>
      </div>
    );
  }

  if (!prospect || outreachHistory === null) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-deep-navy/40 dark:text-warm-white/40" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{prospect.company_name}</CardTitle>
            <div className="flex items-center gap-2">
              <MatchLevelBadge level={prospect.match_level} />
              {latest && <OutreachStatusBadge status={latest.status} />}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-deep-navy/50 dark:text-warm-white/50">
                {t("table.fitScore")}
              </p>
              <p className="mt-0.5 font-mono text-sm text-deep-navy dark:text-warm-white">
                {prospect.fit_score !== null ? prospect.fit_score.toFixed(2) : "--"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-deep-navy/50 dark:text-warm-white/50">
                {t("prospectDetail.contactEmail")}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-deep-navy dark:text-warm-white">
                <Mail className="h-[18px] w-[18px]" />
                {prospect.company_email ?? t("prospectDetail.noEmail")}
              </p>
            </div>
          </div>
          {prospect.reason && (
            <div>
              <p className="text-xs uppercase tracking-wide text-deep-navy/50 dark:text-warm-white/50">
                {t("prospectDetail.whyThisMatch")}
              </p>
              <p className="mt-0.5 text-sm text-deep-navy/80 dark:text-warm-white/80">{prospect.reason}</p>
            </div>
          )}
          {prospect.product && (
            <p className="text-xs text-deep-navy/50 dark:text-warm-white/50">
              {t("prospectDetail.forProduct", { product: prospect.product.product_name })}
            </p>
          )}
        </CardContent>
      </Card>

      {actionError && (
        <div className="flex items-start gap-3 rounded-xl2 border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{actionError}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("prospectDetail.outreachTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(!latest || latest.status === "not_sent") && (
            <label className="flex items-center gap-2 text-sm text-deep-navy/70 dark:text-warm-white/70">
              <input
                type="checkbox"
                checked={useRealAgents}
                onChange={(e) => setUseRealAgents(e.target.checked)}
                className="h-4 w-4 rounded border-soft-gray text-primary-blue focus:ring-primary-blue dark:border-white/20"
              />
              {t("newProduct.useRealAgents")}
            </label>
          )}
          {!latest && (
            <div className="space-y-3">
              <p className="text-sm text-deep-navy/60 dark:text-warm-white/60">{t("prospectDetail.noDraftYet")}</p>
              <Button
                size="sm"
                disabled={pendingAction === "draft" || !prospect.company_email || !prospect.product}
                onClick={handleDraft}
                title={!prospect.company_email ? t("results.noEmailOnFile") : undefined}
              >
                {pendingAction === "draft" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {t("results.draftOutreach")}
              </Button>
              {!prospect.company_email && (
                <p className="text-xs text-deep-navy/50 dark:text-warm-white/50">
                  {t("results.noEmailOnFile")}
                </p>
              )}
            </div>
          )}

          {latest && (
            <div className="space-y-4">
              {latest.status === "failed" && latest.status_reason && (
                <div className="flex items-start gap-3 rounded-xl2 border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">{t("prospectDetail.sendFailedTitle")}</p>
                    <p className="mt-1">{latest.status_reason}</p>
                  </div>
                </div>
              )}

              <div className="rounded-xl2 border border-soft-gray p-4 dark:border-white/10">
                {latest.email_subject ? (
                  <>
                    <p className="text-sm font-semibold text-deep-navy dark:text-warm-white">
                      {latest.email_subject}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-deep-navy/80 dark:text-warm-white/80">
                      {latest.message}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-deep-navy/60 dark:text-warm-white/60">
                    {latest.status_reason ?? t("prospectDetail.noDraftContent")}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {latest.status === "draft" && (
                  <Button size="sm" disabled={pendingAction === "approve"} onClick={handleApprove}>
                    {pendingAction === "approve" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ThumbsUp className="h-4 w-4" />
                    )}
                    {t("prospectDetail.approve")}
                  </Button>
                )}
                {latest.status === "approved" && (
                  <Button size="sm" disabled={pendingAction === "send"} onClick={handleSend}>
                    {pendingAction === "send" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {t("prospectDetail.send")}
                  </Button>
                )}
                {latest.status === "failed" && (
                  <Button size="sm" disabled={pendingAction === "send"} onClick={handleSend}>
                    {pendingAction === "send" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {t("prospectDetail.retrySend")}
                  </Button>
                )}
                {latest.status === "not_sent" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pendingAction === "draft" || !prospect.company_email || !prospect.product}
                    onClick={handleDraft}
                  >
                    {pendingAction === "draft" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {t("prospectDetail.retryDraft")}
                  </Button>
                )}
              </div>

              <p className="text-xs text-deep-navy/40 dark:text-warm-white/40">
                {t("prospectDetail.lastUpdated", { date: formatDate(latest.sent_at ?? latest.created_at) })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
