"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useAuth } from "@/lib/auth/auth-context";
import { useTranslations } from "@/lib/i18n/I18nProvider";

export default function SettingsPage() {
  const { t } = useTranslations();
  const { user, workspace } = useAuth();

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Name</Label>
            <Input defaultValue={user?.name} readOnly />
          </div>
          <div className="col-span-2">
            <Label>{t("onboarding.personal.email")}</Label>
            <Input defaultValue={user?.email} readOnly />
          </div>
          <div>
            <Label>{t("onboarding.personal.jobTitle")}</Label>
            <Input defaultValue={user?.jobTitle ?? ""} readOnly />
          </div>
          <div>
            <Label>{t("onboarding.personal.mobile")}</Label>
            <Input defaultValue={user?.phone ?? ""} readOnly />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Company</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("onboarding.company.companyName")}</Label>
            <Input defaultValue={workspace?.name} readOnly />
          </div>
          <div>
            <Label>{t("onboarding.company.industry")}</Label>
            <Input defaultValue={workspace?.industry ?? ""} readOnly />
          </div>
          <div>
            <Label>{t("onboarding.company.country")}</Label>
            <Input defaultValue={workspace?.country ?? ""} readOnly />
          </div>
          <div>
            <Label>{t("onboarding.company.city")}</Label>
            <Input defaultValue={workspace?.city ?? ""} readOnly />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-deep-navy dark:text-warm-white">Language</p>
            <p className="text-xs text-deep-navy/60 dark:text-warm-white/60">Persists across sessions</p>
          </div>
          <LanguageSwitcher />
        </CardContent>
        <CardContent className="flex items-center justify-between gap-6 pt-0">
          <div>
            <p className="text-sm font-medium text-deep-navy dark:text-warm-white">Theme</p>
            <p className="text-xs text-deep-navy/60 dark:text-warm-white/60">Light or dark, persists across sessions</p>
          </div>
          <ThemeToggle />
        </CardContent>
      </Card>

      <p className="text-xs text-deep-navy/50 dark:text-warm-white/50">
        Profile and company fields come from your account and are read-only here. Editing,
        notifications, and integrations settings land in a later build slice.
      </p>
    </div>
  );
}
