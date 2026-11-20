"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { completeOnboarding } from "@/lib/api-client/auth";
import { ApiError } from "@/lib/api-client/client";
import { useAuth } from "@/lib/auth/auth-context";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useOnboarding } from "@/lib/onboarding/onboarding-context";

import { CompanyInfoStep } from "./CompanyInfoStep";
import { onboardingSchema, stepFields, type OnboardingFormValues } from "./onboarding-schema";
import { PersonalInfoStep } from "./PersonalInfoStep";
import { PreviewStep } from "./PreviewStep";
import { StepIndicator } from "./StepIndicator";

export function OnboardingWizard() {
  const { t, locale } = useTranslations();
  const router = useRouter();
  const { token, isAuthenticated, isHydrated: authHydrated, refreshMe } = useAuth();
  const { data, updateData, step, setStep, isHydrated } = useOnboarding();
  const [submitted, setSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Onboarding writes to a real account -- there must be one first.
  useEffect(() => {
    if (authHydrated && !isAuthenticated) {
      router.replace(`/${locale}/signup`);
    }
  }, [authHydrated, isAuthenticated, locale, router]);

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    getValues,
    formState: { errors },
  } = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    // `values` (not defaultValues) keeps the form in sync once the
    // onboarding context hydrates from localStorage, so switching language
    // or theme mid-flow never loses what was already typed.
    values: isHydrated ? data : undefined,
  });

  const steps = [
    { label: t("onboarding.step.company") },
    { label: t("onboarding.step.personal") },
    { label: t("onboarding.step.preview") },
  ];

  async function goNext() {
    const fields = stepFields[step];
    const valid = fields.length === 0 || (await trigger(fields));
    if (!valid) return;
    updateData(getValues());
    setStep(Math.min(step + 1, steps.length - 1));
  }

  function goBack() {
    updateData(getValues());
    setStep(Math.max(step - 1, 0));
  }

  async function onConfirm(values: OnboardingFormValues) {
    updateData(values);
    setSubmitError(null);

    if (!token) {
      // Shouldn't normally happen (the guard above redirects first), but
      // don't silently pretend success if it does.
      setSubmitError("You're not signed in. Please sign up again.");
      return;
    }

    setIsSaving(true);
    try {
      await completeOnboarding(token, {
        company_name: values.companyName,
        industry: values.industry,
        website: values.website,
        country: values.country,
        city: values.city,
        company_description: values.companyDescription,
        name: `${values.firstName} ${values.lastName}`.trim() || undefined,
        job_title: values.jobTitle,
        phone: values.mobileNumber ? `${values.mobileCountryCode} ${values.mobileNumber}`.trim() : undefined,
      });
      await refreshMe(); // so the app shell shows the real name/company immediately
      setSubmitted(true);
      setTimeout(() => router.push(`/${locale}/dashboard`), 1400);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Could not save your info. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <CheckCircle2 className="h-12 w-12 text-turquoise" />
        <p className="mt-4 text-lg font-medium text-deep-navy dark:text-warm-white">
          {t("onboarding.success")}
        </p>
      </div>
    );
  }

  const watchProductDescription = watch("productDescription") ?? "";

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-8 md:grid-cols-[220px_1fr] md:px-6">
      <aside>
        <div className="mb-6 text-xl font-semibold text-deep-navy dark:text-warm-white">{t("app.name")}</div>
        <StepIndicator steps={steps} currentStep={step} onStepClick={setStep} />
      </aside>

      <form
        onSubmit={handleSubmit(onConfirm)}
        className="space-y-6"
        onKeyDown={(e) => {
          if (e.key === "Enter" && step < steps.length - 1) e.preventDefault();
        }}
      >
        <div>
          <h2 className="text-xl font-semibold text-deep-navy dark:text-warm-white">
            {step === 0 && t("onboarding.company.title")}
            {step === 1 && t("onboarding.personal.title")}
            {step === 2 && t("onboarding.preview.title")}
          </h2>
          <p className="text-sm text-deep-navy/60 dark:text-warm-white/60">
            {step === 0 && t("onboarding.company.subtitle")}
            {step === 1 && t("onboarding.personal.subtitle")}
            {step === 2 && t("onboarding.preview.subtitle")}
          </p>
        </div>

        {step === 0 && (
          <CompanyInfoStep register={register} errors={errors} watchProductDescription={watchProductDescription} />
        )}
        {step === 1 && <PersonalInfoStep register={register} errors={errors} />}
        {step === 2 && <PreviewStep values={getValues()} />}

        {submitError && (
          <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {submitError}
          </p>
        )}

        <div className="flex items-center justify-between pt-2">
          <Button type="button" variant="outline" onClick={goBack} disabled={step === 0}>
            {t("onboarding.back")}
          </Button>
          {step < steps.length - 1 ? (
            <Button type="button" variant="secondary" onClick={goNext}>
              {t("onboarding.next")}
            </Button>
          ) : (
            <Button type="submit" variant="primary" disabled={isSaving}>
              {t("onboarding.confirm")}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
