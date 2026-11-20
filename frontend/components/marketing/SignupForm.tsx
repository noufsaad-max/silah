"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth/auth-context";
import { useTranslations } from "@/lib/i18n/I18nProvider";

const schema = z
  .object({
    firstName: z.string().min(1, "Required"),
    lastName: z.string().min(1, "Required"),
    email: z.string().min(1, "Required").email("Enter a valid email address"),
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string().min(1, "Required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export function SignupForm() {
  const { t, locale } = useTranslations();
  const { register: registerAccount } = useAuth();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    // The company/workspace name is collected later in onboarding, not at
    // signup -- this placeholder is what the workspace is called until the
    // onboarding wizard's "Confirm" step renames it via
    // POST /api/v1/onboarding/complete.
    const result = await registerAccount({
      workspaceName: `${values.firstName} ${values.lastName}'s Workspace`,
      name: `${values.firstName} ${values.lastName}`,
      email: values.email,
      password: values.password,
      locale,
    });
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    router.push(`/${locale}/onboarding`);
  }

  return (
    <div className="w-full rounded-xl2 border border-white/10 bg-deep-navy/95 p-6 text-warm-white shadow-xl">
      <h2 className="text-xl font-semibold">{t("signup.title")}</h2>
      <p className="mt-1 text-sm text-warm-white/70">{t("signup.subtitle")}</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="firstName" className="text-warm-white">
              {t("signup.firstName")}
            </Label>
            <Input id="firstName" error={!!errors.firstName} {...register("firstName")} />
          </div>
          <div>
            <Label htmlFor="lastName" className="text-warm-white">
              {t("signup.lastName")}
            </Label>
            <Input id="lastName" error={!!errors.lastName} {...register("lastName")} />
          </div>
        </div>
        <div>
          <Label htmlFor="email" className="text-warm-white">
            {t("signup.email")}
          </Label>
          <Input id="email" type="email" error={!!errors.email} {...register("email")} />
          {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="password" className="text-warm-white">
              {t("signup.password")}
            </Label>
            <Input id="password" type="password" error={!!errors.password} {...register("password")} />
            {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
          </div>
          <div>
            <Label htmlFor="confirmPassword" className="text-warm-white">
              {t("signup.confirmPassword")}
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              error={!!errors.confirmPassword}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-400">{errors.confirmPassword.message}</p>
            )}
          </div>
        </div>

        {formError && (
          <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {formError}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isSubmitting}>
          {t("signup.submit")}
        </Button>

        <p className="text-center text-sm text-warm-white/70">
          {t("signup.haveAccount")}{" "}
          <a href={`/${locale}/login`} className="font-medium text-primary-blue hover:underline">
            {t("signup.signIn")}
          </a>
        </p>
      </form>
    </div>
  );
}
