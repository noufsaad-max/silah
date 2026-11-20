import Link from "next/link";

import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { SignupForm } from "@/components/marketing/SignupForm";

export default function SignupPage() {
  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-deep-navy px-4 py-12">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_bottom,_#122A52_0%,_#07111F_65%)]"
      />
      <div className="absolute end-4 top-4 flex items-center gap-3">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md">
        <Link href="../" className="mb-6 block text-center text-2xl font-semibold text-warm-white">
          Silah | صلة
        </Link>
        <SignupForm />
      </div>
    </div>
  );
}
