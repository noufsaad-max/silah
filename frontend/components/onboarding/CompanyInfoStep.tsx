"use client";

import type { UseFormRegister, FieldErrors } from "react-hook-form";
import { Building2, PackageSearch } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslations } from "@/lib/i18n/I18nProvider";

import type { OnboardingFormValues } from "./onboarding-schema";

interface StepProps {
  register: UseFormRegister<OnboardingFormValues>;
  errors: FieldErrors<OnboardingFormValues>;
  watchProductDescription: string;
}

export function CompanyInfoStep({ register, errors, watchProductDescription }: StepProps) {
  const { t } = useTranslations();

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-xl2 border border-soft-gray p-5 dark:border-white/10">
        <div className="mb-4 flex items-center gap-2">
          <PackageSearch className="h-[18px] w-[18px] text-turquoise" aria-hidden="true" />
          <h3 className="font-semibold text-deep-navy dark:text-warm-white">
            {t("onboarding.company.productInfo")}
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="productDescription">{t("onboarding.company.productDescription")}</Label>
            <Textarea
              id="productDescription"
              maxLength={500}
              placeholder={t("onboarding.company.productDescriptionPlaceholder")}
              error={!!errors.productDescription}
              {...register("productDescription")}
            />
            <div className="mt-1 flex items-center justify-between text-xs text-deep-navy/40 dark:text-warm-white/40">
              <span>{errors.productDescription?.message}</span>
              <span>{watchProductDescription?.length ?? 0}/500</span>
            </div>
          </div>

          <div>
            <Label htmlFor="productName">{t("onboarding.company.productName")}</Label>
            <Input
              id="productName"
              placeholder={t("onboarding.company.productNamePlaceholder")}
              error={!!errors.productName}
              {...register("productName")}
            />
            {errors.productName && <p className="mt-1 text-xs text-red-500">{errors.productName.message}</p>}
          </div>

          <div>
            <Label htmlFor="differentiators">{t("onboarding.company.description")}</Label>
            <Textarea
              id="differentiators"
              maxLength={300}
              placeholder={t("onboarding.company.descriptionPlaceholder")}
              {...register("differentiators")}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl2 border border-soft-gray p-5 dark:border-white/10">
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="h-[18px] w-[18px] text-turquoise" aria-hidden="true" />
          <h3 className="font-semibold text-deep-navy dark:text-warm-white">
            {t("onboarding.company.companyName")}
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="companyName">{t("onboarding.company.companyName")}</Label>
            <Input
              id="companyName"
              placeholder={t("onboarding.company.companyNamePlaceholder")}
              error={!!errors.companyName}
              {...register("companyName")}
            />
            {errors.companyName && <p className="mt-1 text-xs text-red-500">{errors.companyName.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="industry">{t("onboarding.company.industry")}</Label>
              <Input id="industry" error={!!errors.industry} {...register("industry")} />
              {errors.industry && <p className="mt-1 text-xs text-red-500">{errors.industry.message}</p>}
            </div>
            <div>
              <Label htmlFor="website">{t("onboarding.company.website")}</Label>
              <Input id="website" {...register("website")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="country">{t("onboarding.company.country")}</Label>
              <Input id="country" error={!!errors.country} {...register("country")} />
              {errors.country && <p className="mt-1 text-xs text-red-500">{errors.country.message}</p>}
            </div>
            <div>
              <Label htmlFor="city">{t("onboarding.company.city")}</Label>
              <Input id="city" {...register("city")} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
