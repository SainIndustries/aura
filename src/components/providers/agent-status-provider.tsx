"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";

interface AgentStatusContextType {
  hasRunningAgent: boolean | null;
  agentName: string | null;
  refresh: () => Promise<void>;
}

const AgentStatusContext = createContext<AgentStatusContextType | null>(null);

export function AgentStatusProvider({ children }: { children: React.ReactNode }) {
  const [hasRunningAgent, setHasRunningAgent] = useState<boolean | null>(null);
  const [agentName, setAgentName] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/status");
      if (res.ok) {
        const data = await res.json();
        setHasRunningAgent(data.openclaw?.running ?? false);
        setAgentName(data.openclaw?.agentName ?? null);
      }
    } catch {
      // Silently fail — not critical
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ hasRunningAgent, agentName, refresh }),
    [hasRunningAgent, agentName, refresh]
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
      agentName: null,
      refresh: async () => {},
    };
  }
  return context;
}
