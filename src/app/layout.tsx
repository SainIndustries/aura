import type { Metadata } from "next";
import { Sora, JetBrains_Mono } from "next/font/google";
import { PrivyProvider } from "@/components/providers/privy-provider";
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

export const metadata: Metadata = {
  title: "More Aura — Your AI. Built to run with you.",
  description:
    "Aura is the AI that actually runs with you — scheduling, research, communications, pipeline — unified under one intelligence layer built for people who operate.",
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
      </body>
    </html>
  );
}
