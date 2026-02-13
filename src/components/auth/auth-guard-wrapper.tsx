"use client";

import dynamic from "next/dynamic";

const AuthGuard = dynamic(
  () => import("./auth-guard").then((mod) => ({ default: mod.AuthGuard })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-aura-accent border-t-transparent" />
      </div>
    ),
  }
);

export function AuthGuardWrapper({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  // When Privy is not configured, skip auth guard
  if (!appId || appId === "your-privy-app-id") {
    return <>{children}</>;
  }

  return <AuthGuard>{children}</AuthGuard>;
}
