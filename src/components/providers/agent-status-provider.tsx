"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";

interface AgentInfo {
  id: string;
  name: string;
  running: boolean;
}

interface AgentStatusContextType {
  hasRunningAgent: boolean | null;
  agentName: string | null;
  agents: AgentInfo[];
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string) => void;
  refresh: () => Promise<void>;
}

const AgentStatusContext = createContext<AgentStatusContextType | null>(null);

export function AgentStatusProvider({ children }: { children: React.ReactNode }) {
  const [hasRunningAgent, setHasRunningAgent] = useState<boolean | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/status");
      if (res.ok) {
        const data = await res.json();
        setHasRunningAgent(data.openclaw?.running ?? false);

        const agentsList: AgentInfo[] = data.agents ?? [];
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
    () => ({ hasRunningAgent, agentName, agents, selectedAgentId, setSelectedAgentId, refresh }),
    [hasRunningAgent, agentName, agents, selectedAgentId, refresh]
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
      refresh: async () => {},
    };
  }
  return context;
}
