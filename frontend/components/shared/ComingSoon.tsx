import { Construction } from "lucide-react";

export function ComingSoon({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-xl2 border border-dashed border-soft-gray p-10 text-center dark:border-white/10">
      <Construction className="h-10 w-10 text-deep-navy/30 dark:text-warm-white/30" aria-hidden="true" />
      <h2 className="mt-4 text-lg font-semibold text-deep-navy dark:text-warm-white">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-deep-navy/60 dark:text-warm-white/60">{subtitle}</p>
    </div>
  );
}
