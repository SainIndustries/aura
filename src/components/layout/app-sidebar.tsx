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
  User,
  Sun,
  Moon,
  Home,
  ListChecks,
  MoreHorizontal,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogoMark, LogoWordmark } from "@/components/marketing/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/components/providers/theme-provider";

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
  const { theme, toggleTheme } = useTheme();
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-aura-elevated focus:outline-none">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-aura-accent/20 text-xs text-aura-accent">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 truncate">
                <p className="truncate text-sm text-aura-text-white">{email}</p>
              </div>
              <MoreHorizontal className="h-4 w-4 text-aura-text-dim" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="top"
            className="w-56 bg-aura-surface border-aura-border"
          >
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center gap-3 cursor-pointer">
                <User className="h-4 w-4" />
                <span>My profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={toggleTheme}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-3">
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
                <span>Toggle theme</span>
              </div>
              <kbd className="ml-auto inline-flex h-5 items-center rounded border border-aura-border bg-aura-elevated px-1.5 text-[10px] font-medium text-aura-text-dim">
                M
              </kbd>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-aura-border" />
            <DropdownMenuItem asChild>
              <Link href="/" className="flex items-center gap-3 cursor-pointer">
                <Home className="h-4 w-4" />
                <span>Homepage</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/onboarding" className="flex items-center gap-3 cursor-pointer">
                <ListChecks className="h-4 w-4" />
                <span>Onboarding</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-aura-border" />
            <DropdownMenuItem
              onClick={() => logout().then(() => (window.location.href = "/"))}
              className="flex items-center gap-3 cursor-pointer text-red-400 focus:text-red-400"
            >
              <LogOut className="h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
