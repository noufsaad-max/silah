import type { Metadata } from "next";

import { AuthProvider } from "@/lib/auth/auth-context";
import { direction, locales, type Locale } from "@/lib/i18n/config";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { OnboardingProvider } from "@/lib/onboarding/onboarding-context";
import { ThemeProvider } from "@/lib/theme/theme-provider";

import "../globals.css";

export const metadata: Metadata = {
  title: "Silah | صلة",
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: Locale };
}) {
  const locale = locales.includes(params.locale) ? params.locale : "en";

  return (
    <html lang={locale} dir={direction[locale]} suppressHydrationWarning>
      <body
        className={`min-h-screen bg-warm-white font-sans text-deep-navy antialiased dark:bg-deep-navy dark:text-warm-white ${
          locale === "ar" ? "font-arabic" : ""
        }`}
      >
        <ThemeProvider>
          <I18nProvider locale={locale}>
            <AuthProvider>
              <OnboardingProvider>{children}</OnboardingProvider>
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
