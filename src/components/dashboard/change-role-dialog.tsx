"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TeamRole } from "./team-member-card";

interface ChangeRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRole: TeamRole;
  memberName: string;
  onConfirm: (newRole: TeamRole) => Promise<void>;
  isLoading: boolean;
}

export function ChangeRoleDialog({
  open,
  onOpenChange,
  currentRole,
  memberName,
  onConfirm,
  isLoading,
}: ChangeRoleDialogProps) {
  const [selectedRole, setSelectedRole] = useState<TeamRole>(currentRole);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedRole(currentRole);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Role</DialogTitle>
          <DialogDescription>
            Update the role for <span className="font-medium">{memberName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>New Role</Label>
            <Select
              value={selectedRole}
              onValueChange={(v) => setSelectedRole(v as TeamRole)}
            >
              <SelectTrigger className="bg-aura-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">
                  <div className="flex flex-col items-start">
                    <span>Admin</span>
                    <span className="text-xs text-aura-text-dim">
                      Can manage agents, integrations, and team
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="member">
                  <div className="flex flex-col items-start">
                    <span>Member</span>
                    <span className="text-xs text-aura-text-dim">
                      Can create and edit agents
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="viewer">
                  <div className="flex flex-col items-start">
                    <span>Viewer</span>
                    <span className="text-xs text-aura-text-dim">
                      Read-only access
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(selectedRole)}
            disabled={isLoading || selectedRole === currentRole}
          >
            {isLoading ? "Updating..." : "Update Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
