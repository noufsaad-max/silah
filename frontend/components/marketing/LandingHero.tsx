"use client";

import Link from "next/link";
import { Compass, LineChart, Target } from "lucide-react";

import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { LoginForm } from "@/components/marketing/LoginForm";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/I18nProvider";

export function LandingHero() {
  const { t, locale } = useTranslations();

  const features = [
    { icon: Compass, label: t("landing.feature.discover") },
    { icon: Target, label: t("landing.feature.reach") },
    { icon: LineChart, label: t("landing.feature.track") },
  ];

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-deep-navy text-warm-white">
      {/* Riyadh-inspired skyline background: gradient placeholder with dark
          overlay. Swap the CSS background-image below for a real photo asset
          once one is provided -- keeping this as a layered gradient avoids
          shipping a stock photo that isn't actually licensed. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_bottom,_#122A52_0%,_#07111F_65%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-deep-navy via-deep-navy/70 to-deep-navy/30"
      />

      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <span className="text-2xl font-semibold">{t("app.wordmark")}</span>
        <nav className="hidden items-center gap-8 text-sm font-medium text-warm-white/80 md:flex">
          <a href="#home" className="text-warm-white">
            {t("nav.home")}
          </a>
          <a href="#features" className="hover:text-warm-white">
            {t("nav.features")}
          </a>
          <a href="#how-it-works" className="hover:text-warm-white">
            {t("nav.howItWorks")}
          </a>
          <a href="#contact" className="hover:text-warm-white">
            {t("nav.contact")}
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <LanguageSwitcher />
          <Link href={`/${locale}/signup`}>
            <Button variant="primary" size="sm">
              {t("nav.signUp")}
            </Button>
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 pb-20 pt-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">{t("landing.title")}</h1>
          <p className="mt-4 text-2xl font-medium text-primary-blue">{t("landing.tagline")}</p>
          <p className="mt-4 max-w-lg text-warm-white/70">{t("landing.description")}</p>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {features.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-start gap-2 rounded-xl2 border border-white/10 bg-white/5 p-4"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="h-[18px] w-[18px] text-turquoise" aria-hidden="true" />
                </span>
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <LoginForm />
      </div>
    </div>
  );
}
