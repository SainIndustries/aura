"use client";

import { useState } from "react";
import { MoreHorizontal, Shield, ShieldCheck, Eye, Crown } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChangeRoleDialog } from "./change-role-dialog";
import { RemoveMemberDialog } from "./remove-member-dialog";

export type TeamRole = "owner" | "admin" | "member" | "viewer";

interface TeamMemberCardProps {
  id: string;
  userId: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  role: TeamRole;
  joinedAt: Date;
  isCurrentUser: boolean;
  onRoleChange: (memberId: string, newRole: TeamRole) => Promise<void>;
  onRemove: (memberId: string) => Promise<void>;
}

const roleConfig: Record<
  TeamRole,
  { label: string; color: string; icon: typeof Crown }
> = {
  owner: {
    label: "Owner",
    color: "bg-aura-amber/20 text-aura-amber",
    icon: Crown,
  },
  admin: {
    label: "Admin",
    color: "bg-aura-accent/20 text-aura-accent",
    icon: ShieldCheck,
  },
  member: {
    label: "Member",
    color: "bg-aura-mint/20 text-aura-mint",
    icon: Shield,
  },
  viewer: {
    label: "Viewer",
    color: "bg-aura-text-dim/20 text-aura-text-dim",
    icon: Eye,
  },
};

export function TeamMemberCard({
  id,
  email,
  name,
  role,
  joinedAt,
  isCurrentUser,
  onRoleChange,
  onRemove,
}: TeamMemberCardProps) {
  const [showChangeRole, setShowChangeRole] = useState(false);
  const [showRemove, setShowRemove] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { label, color, icon: RoleIcon } = roleConfig[role];
  const displayName = name || email || "Unknown";
  const initials = displayName.slice(0, 2).toUpperCase();
  const joinedDate = new Date(joinedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const handleRoleChange = async (newRole: TeamRole) => {
    setIsLoading(true);
    try {
      await onRoleChange(id, newRole);
      setShowChangeRole(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async () => {
    setIsLoading(true);
    try {
      await onRemove(id);
      setShowRemove(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between rounded-lg border border-[rgba(255,255,255,0.05)] bg-aura-surface p-4 transition-colors hover:border-[rgba(79,143,255,0.12)]">
        <div className="flex items-center gap-4">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-aura-accent/10 text-sm text-aura-accent">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-aura-text-white">
                {displayName}
              </span>
              {isCurrentUser && (
                <span className="text-xs text-aura-text-dim">(you)</span>
              )}
            </div>
            {email && name && (
              <span className="text-sm text-aura-text-dim">{email}</span>
            )}
            <div className="mt-1 text-xs text-aura-text-ghost">
              Joined {joinedDate}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="secondary" className={color}>
            <RoleIcon className="mr-1 h-3 w-3" />
            {label}
          </Badge>

          {role !== "owner" && !isCurrentUser && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-aura-text-dim hover:text-aura-text-light"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowChangeRole(true)}>
                  Change Role
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowRemove(true)}
                  className="text-destructive focus:text-destructive"
                >
                  Remove Member
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <ChangeRoleDialog
        open={showChangeRole}
        onOpenChange={setShowChangeRole}
        currentRole={role}
        memberName={displayName}
        onConfirm={handleRoleChange}
        isLoading={isLoading}
      />

      <RemoveMemberDialog
        open={showRemove}
        onOpenChange={setShowRemove}
        memberName={displayName}
        onConfirm={handleRemove}
        isLoading={isLoading}
      />
    </>
  );
}
