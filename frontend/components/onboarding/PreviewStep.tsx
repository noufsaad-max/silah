"use client";

import { useTranslations } from "@/lib/i18n/I18nProvider";

import type { OnboardingFormValues } from "./onboarding-schema";

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between border-b border-soft-gray py-2 text-sm last:border-0 dark:border-white/10">
      <span className="text-deep-navy/60 dark:text-warm-white/60">{label}</span>
      <span className="font-medium text-deep-navy dark:text-warm-white">{value}</span>
    </div>
  );
}

export function PreviewStep({ values }: { values: OnboardingFormValues }) {
  const { t } = useTranslations();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-xl2 border border-soft-gray p-5 dark:border-white/10">
        <h3 className="mb-2 font-semibold text-deep-navy dark:text-warm-white">
          {t("onboarding.company.title")}
        </h3>
        <Row label={t("onboarding.company.companyName")} value={values.companyName} />
        <Row label={t("onboarding.company.industry")} value={values.industry} />
        <Row label={t("onboarding.company.country")} value={values.country} />
        <Row label={t("onboarding.company.city")} value={values.city} />
        <Row label={t("onboarding.company.productName")} value={values.productName} />
        <Row label={t("onboarding.company.productDescription")} value={values.productDescription} />
      </div>

      <div className="rounded-xl2 border border-soft-gray p-5 dark:border-white/10">
        <h3 className="mb-2 font-semibold text-deep-navy dark:text-warm-white">
          {t("onboarding.personal.title")}
        </h3>
        <Row label={t("onboarding.personal.firstName")} value={values.firstName} />
        <Row label={t("onboarding.personal.lastName")} value={values.lastName} />
        <Row
          label={t("onboarding.personal.mobile")}
          value={values.mobileNumber ? `${values.mobileCountryCode} ${values.mobileNumber}` : undefined}
        />
        <Row label={t("onboarding.personal.email")} value={values.workEmail} />
        <Row label={t("onboarding.personal.jobTitle")} value={values.jobTitle} />
      </div>
    </div>
  );
}
