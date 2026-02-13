"use client";

import { PrivyProvider as BasePrivyProvider } from "@privy-io/react-auth";

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  // Skip Privy during build or when app ID is not configured
  if (!appId || appId === "your-privy-app-id") {
    return <>{children}</>;
  }

  return (
    <BasePrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "google", "github", "sms", "passkey"],
        appearance: {
          theme: "dark",
          accentColor: "#4f8fff",
          logo: "/logo.svg",
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
          solana: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      {children}
    </BasePrivyProvider>
  );
}
