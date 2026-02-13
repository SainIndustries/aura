import { ThemeProvider } from "@/components/providers/theme-provider";

// Force dynamic rendering for marketing pages since they use client-side theme
export const dynamic = "force-dynamic";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
