"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { AlertCircle, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { discoverSchema, type DiscoverFormValues } from "@/components/pipeline/discover-schema";
import { ApiError } from "@/lib/api-client/client";
import { discover } from "@/lib/api-client/pipeline";
import { useAuth } from "@/lib/auth/auth-context";
import { useRealAgentsPreference } from "@/lib/hooks/useRealAgentsPreference";
import { useTranslations } from "@/lib/i18n/I18nProvider";

export default function NewProductPage() {
  const { t, locale } = useTranslations();
  const { token, user, workspace } = useAuth();
  const router = useRouter();

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [clarification, setClarification] = useState<string | null>(null);
  const [useRealAgents, setUseRealAgents] = useRealAgentsPreference();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<DiscoverFormValues>({
    resolver: zodResolver(discoverSchema),
    defaultValues: {
      senderName: user?.name ?? "",
      senderCompanyName: workspace?.name ?? "",
      senderEmail: user?.email ?? "",
      senderPhone: user?.phone ?? "",
      requestedCompanyCount: 5,
    },
  });

  const productDescription = watch("productDescription");

  async function onSubmit(values: DiscoverFormValues) {
    if (!token) return;
    setSubmitError(null);
    setClarification(null);

    try {
      const result = await discover(token, {
        product_name: values.productName,
        product_description: values.productDescription,
        sender_name: values.senderName,
        sender_company_name: values.senderCompanyName,
        sender_email: values.senderEmail,
        sender_phone: values.senderPhone,
        preferred_city: values.preferredCity || undefined,
        requested_company_count: values.requestedCompanyCount,
      }, useRealAgents);

      if (result.status === "needs_clarification") {
        setClarification(
          result.clarification_question ?? t("newProduct.clarificationFallback")
        );
        return;
      }

      router.push(`/${locale}/products/${result.product.id}/results?run=${result.run.id}`);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : t("newProduct.genericError"));
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-deep-navy dark:text-warm-white">{t("newProduct.title")}</h2>
        <p className="mt-1 text-sm text-deep-navy/60 dark:text-warm-white/60">{t("newProduct.subtitle")}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("newProduct.productSection")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="productName">{t("newProduct.productName")}</Label>
              <Input
                id="productName"
                placeholder={t("newProduct.productNamePlaceholder")}
                error={!!errors.productName}
                {...register("productName")}
              />
              {errors.productName && <p className="mt-1 text-xs text-red-500">{errors.productName.message}</p>}
            </div>

            <div>
              <Label htmlFor="productDescription">{t("newProduct.productDescription")}</Label>
              <Textarea
                id="productDescription"
                rows={5}
                maxLength={1000}
                placeholder={t("newProduct.productDescriptionPlaceholder")}
                error={!!errors.productDescription}
                {...register("productDescription")}
              />
              <div className="mt-1 flex items-center justify-between text-xs text-deep-navy/40 dark:text-warm-white/40">
                <span>{errors.productDescription?.message}</span>
                <span>{productDescription?.length ?? 0}/1000</span>
              </div>
              <p className="mt-1 text-xs text-deep-navy/50 dark:text-warm-white/50">
                {t("newProduct.productDescriptionHint")}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="preferredCity">{t("newProduct.preferredCity")}</Label>
                <Input
                  id="preferredCity"
                  placeholder={t("newProduct.preferredCityPlaceholder")}
                  {...register("preferredCity")}
                />
              </div>
              <div>
                <Label htmlFor="requestedCompanyCount">{t("newProduct.requestedCompanyCount")}</Label>
                <Input
                  id="requestedCompanyCount"
                  type="number"
                  min={1}
                  max={50}
                  {...register("requestedCompanyCount")}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("newProduct.senderSection")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-deep-navy/50 dark:text-warm-white/50">{t("newProduct.senderHint")}</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="senderName">{t("newProduct.senderName")}</Label>
                <Input id="senderName" error={!!errors.senderName} {...register("senderName")} />
                {errors.senderName && <p className="mt-1 text-xs text-red-500">{errors.senderName.message}</p>}
              </div>
              <div>
                <Label htmlFor="senderCompanyName">{t("newProduct.senderCompanyName")}</Label>
                <Input
                  id="senderCompanyName"
                  error={!!errors.senderCompanyName}
                  {...register("senderCompanyName")}
                />
                {errors.senderCompanyName && (
                  <p className="mt-1 text-xs text-red-500">{errors.senderCompanyName.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="senderEmail">{t("newProduct.senderEmail")}</Label>
                <Input id="senderEmail" type="email" error={!!errors.senderEmail} {...register("senderEmail")} />
                {errors.senderEmail && <p className="mt-1 text-xs text-red-500">{errors.senderEmail.message}</p>}
              </div>
              <div>
                <Label htmlFor="senderPhone">{t("newProduct.senderPhone")}</Label>
                <Input id="senderPhone" error={!!errors.senderPhone} {...register("senderPhone")} />
                {errors.senderPhone && <p className="mt-1 text-xs text-red-500">{errors.senderPhone.message}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {clarification && (
          <div className="flex items-start gap-3 rounded-xl2 border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">{t("newProduct.clarificationTitle")}</p>
              <p className="mt-1">{clarification}</p>
              <p className="mt-2 text-xs opacity-80">{t("newProduct.clarificationHint")}</p>
            </div>
          </div>
        )}

        {submitError && (
          <div className="flex items-start gap-3 rounded-xl2 border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{submitError}</p>
          </div>
        )}

        <label className="flex items-start gap-2.5 rounded-xl2 border border-soft-gray p-4 text-sm dark:border-white/10">
          <input
            type="checkbox"
            checked={useRealAgents}
            onChange={(e) => setUseRealAgents(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-soft-gray text-primary-blue focus:ring-primary-blue dark:border-white/20"
          />
          <span>
            <span className="font-medium text-deep-navy dark:text-warm-white">{t("newProduct.useRealAgents")}</span>
            <span className="mt-0.5 block text-xs text-deep-navy/60 dark:text-warm-white/60">
              {t("newProduct.useRealAgentsHint")}
            </span>
          </span>
        </label>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isSubmitting ? t("newProduct.submitting") : t("newProduct.submit")}
          </Button>
        </div>
      </form>
    </div>
  );
}
