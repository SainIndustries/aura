"use client";

import { useState, useEffect } from "react";
import { Search, X, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Agent {
  id: string;
  name: string;
}

interface AuditLogFiltersProps {
  agents: Agent[];
  onFilterChange: (filters: AuditLogFilters) => void;
  initialFilters?: AuditLogFilters;
}

export interface AuditLogFilters {
  search: string;
  category: string;
  status: string;
  agentId: string;
  startDate: string;
  endDate: string;
}

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "agent", label: "Agent" },
  { value: "communication", label: "Communication" },
  { value: "calendar", label: "Calendar" },
  { value: "pipeline", label: "Pipeline" },
  { value: "integration", label: "Integration" },
  { value: "system", label: "System" },
  { value: "billing", label: "Billing" },
];

const STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "success", label: "Success" },
  { value: "failure", label: "Failure" },
  { value: "pending", label: "Pending" },
];

export function AuditLogFilters({
  agents,
  onFilterChange,
  initialFilters,
}: AuditLogFiltersProps) {
  const [filters, setFilters] = useState<AuditLogFilters>(
    initialFilters || {
      search: "",
      category: "all",
      status: "all",
      agentId: "all",
      startDate: "",
      endDate: "",
    }
  );

  const [searchInput, setSearchInput] = useState(filters.search);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        const newFilters = { ...filters, search: searchInput };
        setFilters(newFilters);
        onFilterChange(newFilters);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, filters, onFilterChange]);

  const handleFilterChange = (key: keyof AuditLogFilters, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    const defaultFilters: AuditLogFilters = {
      search: "",
      category: "all",
      status: "all",
      agentId: "all",
      startDate: "",
      endDate: "",
    };
    setFilters(defaultFilters);
    setSearchInput("");
    onFilterChange(defaultFilters);
  };

  const hasActiveFilters =
    filters.search ||
    filters.category !== "all" ||
    filters.status !== "all" ||
    filters.agentId !== "all" ||
    filters.startDate ||
    filters.endDate;

  return (
    <div className="space-y-4">
      {/* Search and quick filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-aura-text-ghost" />
          <Input
            placeholder="Search actions or descriptions..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 bg-aura-surface border-aura-border"
          />
        </div>

        {/* Category */}
        <Select
          value={filters.category}
          onValueChange={(value) => handleFilterChange("category", value)}
        >
          <SelectTrigger className="w-[160px] bg-aura-surface border-aura-border">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="bg-aura-surface border-aura-border">
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status */}
        <Select
          value={filters.status}
          onValueChange={(value) => handleFilterChange("status", value)}
        >
          <SelectTrigger className="w-[140px] bg-aura-surface border-aura-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-aura-surface border-aura-border">
            {STATUSES.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Agent */}
        {agents.length > 0 && (
          <Select
            value={filters.agentId}
            onValueChange={(value) => handleFilterChange("agentId", value)}
          >
            <SelectTrigger className="w-[160px] bg-aura-surface border-aura-border">
              <SelectValue placeholder="Agent" />
            </SelectTrigger>
            <SelectContent className="bg-aura-surface border-aura-border">
              <SelectItem value="all">All Agents</SelectItem>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Date range row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-aura-text-ghost" />
          <span className="text-sm text-aura-text-dim">From:</span>
          <Input
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange("startDate", e.target.value)}
            className="w-[150px] bg-aura-surface border-aura-border"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-aura-text-dim">To:</span>
          <Input
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange("endDate", e.target.value)}
            className="w-[150px] bg-aura-surface border-aura-border"
          />
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-aura-text-dim hover:text-aura-text-light"
          >
            <X className="mr-1 h-4 w-4" />
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
