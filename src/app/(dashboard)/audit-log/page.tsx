"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  AuditLogFilters,
  type AuditLogFilters as FilterType,
} from "@/components/dashboard/audit-log-filters";
import {
  AuditLogTable,
  type AuditLogEntry,
} from "@/components/dashboard/audit-log-table";

interface Agent {
  id: string;
  name: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [filters, setFilters] = useState<FilterType>({
    search: "",
    category: "all",
    status: "all",
    agentId: "all",
    startDate: "",
    endDate: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", String(pagination.page));
    params.set("limit", String(pagination.limit));

    if (filters.search) params.set("search", filters.search);
    if (filters.category !== "all") params.set("category", filters.category);
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.agentId !== "all") params.set("agentId", filters.agentId);
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);

    try {
      const res = await fetch(`/api/audit-log?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to fetch audit logs");
      }
      const data = await res.json();
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  // Fetch agents for the filter dropdown
  useEffect(() => {
    async function fetchAgents() {
      try {
        // Reuse the existing agents from the page data or fetch separately
        // For now, we'll extract unique agents from the logs
        const res = await fetch("/api/audit-log?limit=100");
        if (res.ok) {
          const data = await res.json();
          const uniqueAgents = new Map<string, Agent>();
          data.logs.forEach((log: AuditLogEntry) => {
            if (log.agentId && log.agentName) {
              uniqueAgents.set(log.agentId, {
                id: log.agentId,
                name: log.agentName,
              });
            }
          });
          setAgents(Array.from(uniqueAgents.values()));
        }
      } catch {
        // Silently fail - agents filter will just not show
      }
    }
    fetchAgents();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleFilterChange = (newFilters: FilterType) => {
    setFilters(newFilters);
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to first page
  };

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  const handleLimitChange = (limit: number) => {
    setPagination((prev) => ({ ...prev, limit, page: 1 }));
  };

  if (error) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Audit Log"
          description="Track all agent actions and events"
        />
        <Card className="border-[rgba(255,255,255,0.05)] bg-aura-surface">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="mb-4 h-12 w-12 text-destructive" />
            <h3 className="mb-2 text-lg font-semibold">Error Loading Logs</h3>
            <p className="max-w-sm text-center text-sm text-aura-text-dim">
              {error}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Track all agent actions and events"
      />

      <Card className="border-aura-border bg-aura-surface">
        <CardContent className="pt-6">
          <AuditLogFilters
            agents={agents}
            onFilterChange={handleFilterChange}
            initialFilters={filters}
          />
        </CardContent>
      </Card>

      <AuditLogTable
        logs={logs}
        pagination={pagination}
        onPageChange={handlePageChange}
        onLimitChange={handleLimitChange}
        isLoading={isLoading}
      />
    </div>
  );
}
