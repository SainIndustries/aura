"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import {
  LayoutDashboard,
  Bot,
  LayoutTemplate,
  Plug,
  MessageSquare,
  FileText,
  Settings,
  Phone,
  LogOut,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { LogoMark, LogoWordmark } from "@/components/marketing/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const CAL_LINK =
  "https://cal.com/shadman-hossain-k6kwji/15min?overlayCalendar=true";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/channels", label: "Channels", icon: MessageSquare },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/team", label: "Team", icon: Users },
  { href: "/audit-log", label: "Audit Log", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user, logout } = usePrivy();
  const email = user?.email?.address ?? "user@aura.ai";
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/dashboard" className="flex items-center gap-3 no-underline">
          <LogoMark />
          <LogoWordmark />
        </Link>
      </SidebarHeader>

      <Separator className="bg-[rgba(255,255,255,0.05)]" />

      <SidebarContent className="p-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" &&
                    pathname.startsWith(item.href));
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 border-[rgba(255,255,255,0.05)] text-aura-text-light hover:text-aura-text-white"
              asChild
            >
              <a href={CAL_LINK} target="_blank" rel="noopener noreferrer">
                <Phone className="h-4 w-4" />
                Talk to a Human
              </a>
            </Button>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <Separator className="bg-[rgba(255,255,255,0.05)]" />

      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-aura-accent/20 text-xs text-aura-accent">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 truncate">
            <p className="truncate text-sm text-aura-text-white">{email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-aura-text-dim hover:text-aura-text-light"
            onClick={() => logout().then(() => window.location.href = "/")}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
