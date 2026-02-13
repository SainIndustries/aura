import type { Metadata, Viewport } from "next";
import { Sora, JetBrains_Mono } from "next/font/google";
import { PrivyProvider } from "@/components/providers/privy-provider";
import { Toaster } from "sonner";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0b" },
  ],
};

export const metadata: Metadata = {
  title: "More Aura — Your AI. Built to run with you.",
  description:
    "Aura is the AI that actually runs with you — scheduling, research, communications, pipeline — unified under one intelligence layer built for people who operate.",
  keywords: ["AI assistant", "executive AI", "productivity", "automation", "scheduling", "business intelligence"],
  authors: [{ name: "SAIN Industries" }],
  creator: "SAIN Industries",
  publisher: "SAIN Industries",
  metadataBase: new URL("https://www.moreaura.ai"),
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.moreaura.ai",
    siteName: "More Aura",
    title: "More Aura — Your AI. Built to run with you.",
    description:
      "Aura is the AI that actually runs with you — scheduling, research, communications, pipeline — unified under one intelligence layer built for people who operate.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "More Aura - Your Executive AI Assistant",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "More Aura — Your AI. Built to run with you.",
    description:
      "Aura is the AI that actually runs with you — scheduling, research, communications, pipeline — unified under one intelligence layer built for people who operate.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${sora.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <PrivyProvider>{children}</PrivyProvider>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--aura-surface)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              color: "var(--aura-text-white)",
            },
          }}
        />
      </body>
    </html>
  );
}
