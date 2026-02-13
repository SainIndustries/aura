"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export default function SignInPage() {
  const { login, ready, authenticated } = usePrivy();
  const router = useRouter();
  const hasTriggeredLogin = useRef(false);

  useEffect(() => {
    if (ready && authenticated) {
      router.push("/dashboard");
    }
  }, [ready, authenticated, router]);

  useEffect(() => {
    if (ready && !authenticated && !hasTriggeredLogin.current) {
      hasTriggeredLogin.current = true;
      login();
    }
  }, [ready, authenticated, login]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 h-8 w-8 mx-auto animate-spin rounded-full border-2 border-aura-accent border-t-transparent" />
        <p className="text-sm text-aura-text-dim">Loading authentication...</p>
      </div>
    </div>
  );
}
