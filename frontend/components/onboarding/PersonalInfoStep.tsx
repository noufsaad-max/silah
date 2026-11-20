"use client";

import type { UseFormRegister, FieldErrors } from "react-hook-form";
import { User } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "@/lib/i18n/I18nProvider";

import type { OnboardingFormValues } from "./onboarding-schema";

interface StepProps {
  register: UseFormRegister<OnboardingFormValues>;
  errors: FieldErrors<OnboardingFormValues>;
}

export function PersonalInfoStep({ register, errors }: StepProps) {
  const { t } = useTranslations();

  return (
    <div className="mx-auto max-w-2xl rounded-xl2 border border-soft-gray p-5 dark:border-white/10">
      <div className="mb-4 flex items-center gap-2">
        <User className="h-[18px] w-[18px] text-turquoise" aria-hidden="true" />
        <h3 className="font-semibold text-deep-navy dark:text-warm-white">{t("onboarding.personal.title")}</h3>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="firstName">{t("onboarding.personal.firstName")}</Label>
            <Input
              id="firstName"
              placeholder={t("onboarding.personal.firstNamePlaceholder")}
              error={!!errors.firstName}
              {...register("firstName")}
            />
            {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName.message}</p>}
          </div>
          <div>
            <Label htmlFor="lastName">{t("onboarding.personal.lastName")}</Label>
            <Input
              id="lastName"
              placeholder={t("onboarding.personal.lastNamePlaceholder")}
              error={!!errors.lastName}
              {...register("lastName")}
            />
            {errors.lastName && <p className="mt-1 text-xs text-red-500">{errors.lastName.message}</p>}
          </div>
        </div>

        <div>
          <Label htmlFor="mobileNumber">{t("onboarding.personal.mobile")}</Label>
          <div className="flex gap-2">
            <select
              aria-label="Country code"
              className="h-11 rounded-lg border border-soft-gray bg-surface-white px-2 text-sm text-deep-navy dark:border-white/10 dark:bg-white/5 dark:text-warm-white"
              {...register("mobileCountryCode")}
            >
              <option value="+966">🇸🇦 +966</option>
              <option value="+971">🇦🇪 +971</option>
              <option value="+973">🇧🇭 +973</option>
              <option value="+965">🇰🇼 +965</option>
            </select>
            <Input
              id="mobileNumber"
              inputMode="numeric"
              placeholder="50 123 4567"
              error={!!errors.mobileNumber}
              className="flex-1"
              {...register("mobileNumber")}
            />
          </div>
          {errors.mobileNumber && <p className="mt-1 text-xs text-red-500">{errors.mobileNumber.message}</p>}
        </div>

        <div>
          <Label htmlFor="workEmail">{t("onboarding.personal.email")}</Label>
          <Input
            id="workEmail"
            type="email"
            placeholder={t("onboarding.personal.emailPlaceholder")}
            error={!!errors.workEmail}
            {...register("workEmail")}
          />
          {errors.workEmail && <p className="mt-1 text-xs text-red-500">{errors.workEmail.message}</p>}
        </div>

        <div>
          <Label htmlFor="jobTitle">{t("onboarding.personal.jobTitle")}</Label>
          <Input id="jobTitle" {...register("jobTitle")} />
        </div>
      </div>
    </div>
  );
}
