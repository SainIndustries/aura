"use client";

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { AgentStatusProvider } from "@/components/providers/agent-status-provider";
import { LogoWordmark } from "@/components/marketing/logo";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AgentStatusProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex items-center gap-3 px-4 py-3 border-b border-aura-border md:hidden">
            <SidebarTrigger className="text-aura-text-light" />
            <LogoWordmark />
          </header>
          <div className="flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </AgentStatusProvider>
  );
}
