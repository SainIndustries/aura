"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Bot,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface AuditLogEntry {
  id: string;
  category: string;
  action: string;
  description: string;
  metadata: Record<string, unknown> | null;
  status: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  agentId: string | null;
  agentName: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface AuditLogTableProps {
  logs: AuditLogEntry[];
  pagination: Pagination;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  isLoading?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  agent: "bg-aura-purple/20 text-aura-purple-bright border-aura-purple/30",
  communication: "bg-aura-accent/20 text-aura-accent-bright border-aura-accent/30",
  calendar: "bg-aura-amber/20 text-aura-amber border-aura-amber/30",
  pipeline: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  integration: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  system: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  billing: "bg-rose-500/20 text-rose-400 border-rose-500/30",
};

const STATUS_ICONS = {
  success: <CheckCircle2 className="h-4 w-4 text-aura-mint" />,
  failure: <XCircle className="h-4 w-4 text-destructive" />,
  pending: <Clock className="h-4 w-4 text-aura-amber" />,
};

function formatDate(date: string) {
  const d = new Date(date);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatRelativeTime(date: string) {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

function LogRow({ log }: { log: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-aura-border last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-aura-elevated/50"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-aura-text-ghost" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-aura-text-ghost" />
        )}

        {/* Timestamp */}
        <div className="w-[140px] shrink-0 text-sm text-aura-text-dim">
          {formatRelativeTime(log.createdAt)}
        </div>

        {/* Category */}
        <Badge
          variant="outline"
          className={cn(
            "w-[110px] shrink-0 justify-center capitalize",
            CATEGORY_COLORS[log.category] || CATEGORY_COLORS.system
          )}
        >
          {log.category}
        </Badge>

        {/* Status */}
        <div className="w-8 shrink-0">
          {STATUS_ICONS[log.status as keyof typeof STATUS_ICONS] ||
            STATUS_ICONS.pending}
        </div>

        {/* Action & Description */}
        <div className="min-w-0 flex-1">
          <div className="font-medium text-aura-text-light">{log.action}</div>
          <div className="truncate text-sm text-aura-text-dim">
            {log.description}
          </div>
        </div>

        {/* Agent */}
        {log.agentName && (
          <div className="flex items-center gap-1.5 text-sm text-aura-text-dim">
            <Bot className="h-3.5 w-3.5" />
            <span className="max-w-[120px] truncate">{log.agentName}</span>
          </div>
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-aura-border bg-aura-elevated/30 px-4 py-4 pl-12">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-aura-text-ghost">
                Details
              </h4>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-aura-text-ghost">Full Timestamp</dt>
                  <dd className="text-aura-text-light">
                    {formatDate(log.createdAt)}
                  </dd>
                </div>
                {log.agentName && (
                  <div>
                    <dt className="text-aura-text-ghost">Agent</dt>
                    <dd className="text-aura-text-light">{log.agentName}</dd>
                  </div>
                )}
                {log.ipAddress && (
                  <div>
                    <dt className="text-aura-text-ghost">IP Address</dt>
                    <dd className="font-mono text-aura-text-light">
                      {log.ipAddress}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {log.metadata && Object.keys(log.metadata).length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-aura-text-ghost">
                  Metadata
                </h4>
                <pre className="overflow-x-auto rounded-md bg-aura-deep p-3 text-xs text-aura-text-dim">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {log.userAgent && (
            <div className="mt-4">
              <h4 className="mb-1 text-xs font-medium uppercase tracking-wider text-aura-text-ghost">
                User Agent
              </h4>
              <p className="break-all text-xs text-aura-text-dim">
                {log.userAgent}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AuditLogTable({
  logs,
  pagination,
  onPageChange,
  onLimitChange,
  isLoading,
}: AuditLogTableProps) {
  const exportToCSV = () => {
    const headers = [
      "Timestamp",
      "Category",
      "Status",
      "Action",
      "Description",
      "Agent",
      "IP Address",
    ];
    const rows = logs.map((log) => [
      new Date(log.createdAt).toISOString(),
      log.category,
      log.status,
      log.action,
      log.description,
      log.agentName || "",
      log.ipAddress || "",
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToJSON = () => {
    const json = JSON.stringify(logs, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <Card className="border-aura-border bg-aura-surface">
        <CardContent className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-aura-accent border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card className="border-aura-border bg-aura-surface">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Clock className="mb-4 h-12 w-12 text-aura-text-ghost" />
          <h3 className="mb-2 text-lg font-semibold">No logs found</h3>
          <p className="max-w-sm text-center text-sm text-aura-text-dim">
            No audit logs match your current filters. Try adjusting your search
            criteria or check back later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Export buttons */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-aura-text-dim">
          Showing {(pagination.page - 1) * pagination.limit + 1}–
          {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
          {pagination.total} entries
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            className="border-aura-border bg-aura-surface hover:bg-aura-elevated"
          >
            <Download className="mr-1.5 h-4 w-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToJSON}
            className="border-aura-border bg-aura-surface hover:bg-aura-elevated"
          >
            <Download className="mr-1.5 h-4 w-4" />
            JSON
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="border-aura-border bg-aura-surface overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-aura-border bg-aura-elevated/50 px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-aura-text-ghost">
          <div className="w-4" /> {/* Chevron spacer */}
          <div className="w-[140px]">Time</div>
          <div className="w-[110px] text-center">Category</div>
          <div className="w-8 text-center">Status</div>
          <div className="flex-1">Action</div>
          <div className="w-[140px]">Agent</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-aura-border">
          {logs.map((log) => (
            <LogRow key={log.id} log={log} />
          ))}
        </div>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-aura-text-dim">Show</span>
          <Select
            value={String(pagination.limit)}
            onValueChange={(v) => onLimitChange(Number(v))}
          >
            <SelectTrigger className="w-[80px] bg-aura-surface border-aura-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-aura-surface border-aura-border">
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-aura-text-dim">per page</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!pagination.hasPrev}
            onClick={() => onPageChange(pagination.page - 1)}
            className="border-aura-border bg-aura-surface hover:bg-aura-elevated disabled:opacity-50"
          >
            Previous
          </Button>
          <span className="px-3 text-sm text-aura-text-dim">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!pagination.hasNext}
            onClick={() => onPageChange(pagination.page + 1)}
            className="border-aura-border bg-aura-surface hover:bg-aura-elevated disabled:opacity-50"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
