"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useRef } from "react";

export function useUserSync() {
  const { ready, authenticated } = usePrivy();
  const hasSynced = useRef(false);

  useEffect(() => {
    if (ready && authenticated && !hasSynced.current) {
      hasSynced.current = true;
      fetch("/api/auth/sync", { method: "POST" }).catch(console.error);
    }
  }, [ready, authenticated]);
}
