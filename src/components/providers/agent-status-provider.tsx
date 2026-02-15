"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";

interface AgentIntegrations {
  google: boolean;
  slack: boolean;
}

interface AgentInfo {
  id: string;
  name: string;
  running: boolean;
  integrations: AgentIntegrations;
}

interface AgentStatusContextType {
  hasRunningAgent: boolean | null;
  agentName: string | null;
  agents: AgentInfo[];
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string) => void;
  googleAuthorized: boolean;
  refresh: () => Promise<void>;
}

const AgentStatusContext = createContext<AgentStatusContextType | null>(null);

export function AgentStatusProvider({ children }: { children: React.ReactNode }) {
  const [hasRunningAgent, setHasRunningAgent] = useState<boolean | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [googleAuthorized, setGoogleAuthorized] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/status");
      if (res.ok) {
        const data = await res.json();
        setHasRunningAgent(data.openclaw?.running ?? false);
        setGoogleAuthorized(data.google?.connected ?? false);

        const agentsList: AgentInfo[] = (data.agents ?? []).map((a: Record<string, unknown>) => ({
          id: a.id as string,
          name: a.name as string,
          running: a.running as boolean,
          integrations: (a.integrations as AgentIntegrations) ?? { google: false, slack: false },
        }));
        setAgents(agentsList);

        // Auto-select: if current selection is missing from list, pick first running (or first overall)
        setSelectedAgentId((prev) => {
          if (prev && agentsList.some((a) => a.id === prev)) return prev;
          const firstRunning = agentsList.find((a) => a.running);
          return firstRunning?.id ?? agentsList[0]?.id ?? null;
        });
      }
    } catch {
      // Silently fail — not critical
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const agentName = useMemo(() => {
    if (!selectedAgentId) return null;
    return agents.find((a) => a.id === selectedAgentId)?.name ?? null;
  }, [agents, selectedAgentId]);

  const value = useMemo(
    () => ({ hasRunningAgent, agentName, agents, selectedAgentId, setSelectedAgentId, googleAuthorized, refresh }),
    [hasRunningAgent, agentName, agents, selectedAgentId, googleAuthorized, refresh]
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
      agents: [] as AgentInfo[],
      selectedAgentId: null,
      setSelectedAgentId: () => {},
      googleAuthorized: false,
      refresh: async () => {},
    };
  }
  return context;
}
