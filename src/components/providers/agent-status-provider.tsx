"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";

interface AgentStatusContextType {
  hasRunningAgent: boolean | null;
  refresh: () => Promise<void>;
}

const AgentStatusContext = createContext<AgentStatusContextType | null>(null);

export function AgentStatusProvider({ children }: { children: React.ReactNode }) {
  const [hasRunningAgent, setHasRunningAgent] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/status");
      if (res.ok) {
        const data = await res.json();
        setHasRunningAgent(data.openclaw?.running ?? false);
      }
    } catch {
      // Silently fail — not critical
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ hasRunningAgent, refresh }),
    [hasRunningAgent, refresh]
  );

  return (
    <AgentStatusContext.Provider value={value}>
      {children}
    </AgentStatusContext.Provider>
  );
}

export function useAgentStatus() {
  const context = useContext(AgentStatusContext);
  if (context === null) {
    return {
      hasRunningAgent: null,
      refresh: async () => {},
    };
  }
  return context;
}
