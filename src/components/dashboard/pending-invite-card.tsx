"use client";

import { Clock, X, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TeamRole } from "./team-member-card";

interface PendingInviteCardProps {
  id: string;
  email: string;
  role: TeamRole;
  expiresAt: Date;
  onRevoke: (id: string) => Promise<void>;
}

const roleLabels: Record<TeamRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

export function PendingInviteCard({
  id,
  email,
  role,
  expiresAt,
  onRevoke,
}: PendingInviteCardProps) {
  const expiryDate = new Date(expiresAt);
  const daysLeft = Math.ceil(
    (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="flex items-center justify-between rounded-lg border border-dashed border-[rgba(255,255,255,0.08)] bg-aura-base/50 p-4">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-aura-text-dim/10">
          <Mail className="h-4 w-4 text-aura-text-dim" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-aura-text-light">{email}</span>
            <Badge
              variant="secondary"
              className="bg-aura-text-dim/10 text-aura-text-dim"
            >
              {roleLabels[role]}
            </Badge>
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-aura-text-ghost">
            <Clock className="h-3 w-3" />
            <span>
              Expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="text-aura-text-dim hover:text-destructive"
        onClick={() => onRevoke(id)}
      >
        <X className="mr-1 h-4 w-4" />
        Revoke
      </Button>
    </div>
  );
}
