import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Silah | صلة",
  description: "AI-powered B2B prospecting platform.",
};

// The real <html>/<body> tags are rendered in app/[locale]/layout.tsx, since
// direction (RTL/LTR) and lang depend on the locale segment. This root
// layout only exists because Next.js requires one file to own metadata
// defaults at the top of the tree.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
