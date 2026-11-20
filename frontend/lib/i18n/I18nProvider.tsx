"use client";

import { createContext, useContext, useMemo } from "react";

import { dictionaries } from "./dictionaries";
import { direction, type Locale } from "./config";

interface I18nContextValue {
  locale: Locale;
  dir: "ltr" | "rtl";
  // Second arg is optional so every existing t("some.key") call keeps
  // working unchanged. When passed, {placeholder} tokens in the dictionary
  // string are replaced -- e.g. en.json: "a.b": "Found {count} results" +
  // t("a.b", { count: "5" }) -> "Found 5 results".
  t: (key: string, params?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo<I18nContextValue>(() => {
    const dict = dictionaries[locale];
    return {
      locale,
      dir: direction[locale],
      t: (key: string, params?: Record<string, string>) => {
        const template = dict[key] ?? key;
        if (!params) return template;
        return Object.entries(params).reduce(
          (text, [name, value]) => text.replaceAll(`{${name}}`, value),
          template
        );
      },
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslations() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslations must be used within I18nProvider");
  return ctx;
}
