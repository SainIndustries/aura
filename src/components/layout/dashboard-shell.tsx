"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { AgentStatusProvider } from "@/components/providers/agent-status-provider";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AgentStatusProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="flex-1 p-6 lg:p-8">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </AgentStatusProvider>
  );
}
