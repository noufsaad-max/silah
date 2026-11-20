"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/auth-context";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { DEMO_CREDENTIALS } from "@/lib/mock-data";

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const { t, locale } = useTranslations();
  const { login } = useAuth();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: DEMO_CREDENTIALS.email, password: "", rememberMe: true },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const result = await login(values.email, values.password);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    router.push(`/${locale}/dashboard`);
  }

  return (
    <div className="w-full rounded-xl2 border border-white/10 bg-deep-navy/95 p-6 text-warm-white shadow-xl backdrop-blur">
      <h2 className="text-xl font-semibold">{t("login.welcomeBack")}</h2>
      <p className="mt-1 text-sm text-warm-white/70">{t("login.subtitle")}</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="sr-only">
            {t("login.email")}
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-white/40" />
            <input
              id="email"
              type="email"
              placeholder={t("login.email")}
              className="h-11 w-full rounded-lg border border-white/15 bg-white/5 ps-9 pe-3 text-sm text-warm-white placeholder:text-warm-white/40 focus:outline-none focus:ring-2 focus:ring-primary-blue"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
              {...register("email")}
            />
          </div>
          {errors.email && (
            <p id="email-error" className="mt-1 text-xs text-red-400">
              {errors.email.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="sr-only">
            {t("login.password")}
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-white/40" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder={t("login.password")}
              className="h-11 w-full rounded-lg border border-white/15 bg-white/5 ps-9 pe-9 text-sm text-warm-white placeholder:text-warm-white/40 focus:outline-none focus:ring-2 focus:ring-primary-blue"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "password-error" : undefined}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-warm-white/50 hover:text-warm-white"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p id="password-error" className="mt-1 text-xs text-red-400">
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-warm-white/80">
            <input type="checkbox" className="rounded border-white/20 bg-white/5" {...register("rememberMe")} />
            {t("login.rememberMe")}
          </label>
          <a href="#" className="text-primary-blue hover:underline">
            {t("login.forgotPassword")}
          </a>
        </div>

        {formError && (
          <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {formError}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isSubmitting}>
          {t("login.submit")}
        </Button>

        <p className="text-center text-xs text-warm-white/40">{t("login.demoHint")}</p>

        <div className="flex items-center gap-3 text-xs text-warm-white/40">
          <span className="h-px flex-1 bg-white/10" />
          {t("login.orContinueWith")}
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* UI-only: not wired to a real OAuth provider yet -- see README */}
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Not yet connected"
            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/15 text-sm text-warm-white/60"
          >
            {t("login.continueGoogle")}
          </button>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Not yet connected"
            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/15 text-sm text-warm-white/60"
          >
            {t("login.continueMicrosoft")}
          </button>
        </div>

        <p className="text-center text-sm text-warm-white/70">
          {t("login.noAccount")}{" "}
          <a href={`/${locale}/signup`} className="font-medium text-primary-blue hover:underline">
            {t("login.signUp")}
          </a>
        </p>
      </form>
    </div>
  );
}
