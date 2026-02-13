"use client";

import { useState, useEffect, useCallback } from "react";
import { UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { TeamMemberCard, type TeamRole } from "@/components/dashboard/team-member-card";
import { InviteMemberDialog } from "@/components/dashboard/invite-member-dialog";
import { PendingInviteCard } from "@/components/dashboard/pending-invite-card";
import { Skeleton } from "@/components/ui/skeleton";

interface TeamMember {
  id: string;
  userId: string;
  role: TeamRole;
  joinedAt: string;
  user: {
    id: string;
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
  };
}

interface PendingInvite {
  id: string;
  email: string;
  role: TeamRole;
  expiresAt: string;
  createdAt: string;
}

interface TeamPageClientProps {
  currentUserId: string;
}

export function TeamPageClient({ currentUserId }: TeamPageClientProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [membersRes, invitesRes] = await Promise.all([
        fetch("/api/team"),
        fetch("/api/team/invites"),
      ]);

      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(data.members);
      }

      if (invitesRes.ok) {
        const data = await invitesRes.json();
        setInvites(data.invites);
      }
    } catch (error) {
      console.error("Failed to fetch team data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleInvite = async (email: string, role: TeamRole) => {
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to send invite");
    }

    // Refresh data
    await fetchData();
  };

  const handleRoleChange = async (memberId: string, newRole: TeamRole) => {
    const res = await fetch(`/api/team/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to update role");
    }

    // Update local state
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
    );
  };

  const handleRemove = async (memberId: string) => {
    const res = await fetch(`/api/team/${memberId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to remove member");
    }

    // Update local state
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  };

  const handleRevokeInvite = async (inviteId: string) => {
    const res = await fetch(`/api/team/invites?id=${inviteId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      console.error("Failed to revoke invite");
      return;
    }

    // Update local state
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
  };

  if (isLoading) {
    return (
      <>
        <PageHeader
          title="Team"
          description="Manage your workspace team members"
        >
          <Skeleton className="h-10 w-36" />
        </PageHeader>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Team" description="Manage your workspace team members">
        <Button onClick={() => setShowInviteDialog(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Member
        </Button>
      </PageHeader>

      {/* Team Members */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-aura-text-dim" />
          <h2 className="text-lg font-semibold">
            Members ({members.length})
          </h2>
        </div>

        {members.length === 0 ? (
          <Card className="border-[rgba(255,255,255,0.05)] bg-aura-surface">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="mb-4 h-12 w-12 text-aura-text-ghost" />
              <h3 className="mb-2 text-lg font-semibold">No team members yet</h3>
              <p className="mb-6 max-w-sm text-center text-sm text-aura-text-dim">
                Invite colleagues to collaborate on your workspace.
              </p>
              <Button onClick={() => setShowInviteDialog(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <TeamMemberCard
                key={member.id}
                id={member.id}
                userId={member.userId}
                email={member.user?.email ?? null}
                name={member.user?.name ?? null}
                avatarUrl={member.user?.avatarUrl ?? null}
                role={member.role}
                joinedAt={new Date(member.joinedAt)}
                isCurrentUser={member.userId === currentUserId}
                onRoleChange={handleRoleChange}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pending Invites */}
      {invites.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-aura-text-light">
            Pending Invites ({invites.length})
          </h2>
          <div className="space-y-3">
            {invites.map((invite) => (
              <PendingInviteCard
                key={invite.id}
                id={invite.id}
                email={invite.email}
                role={invite.role}
                expiresAt={new Date(invite.expiresAt)}
                onRevoke={handleRevokeInvite}
              />
            ))}
          </div>
        </div>
      )}

      {/* Permissions Info */}
      <Card className="border-[rgba(255,255,255,0.05)] bg-aura-surface">
        <CardHeader>
          <CardTitle className="text-base">Role Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <div className="font-medium text-aura-amber">Owner</div>
              <p className="text-aura-text-dim">
                Full access, can delete workspace, transfer ownership
              </p>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-aura-accent">Admin</div>
              <p className="text-aura-text-dim">
                Can manage agents, integrations, team members
              </p>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-aura-mint">Member</div>
              <p className="text-aura-text-dim">
                Can create/edit agents, view everything
              </p>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-aura-text-dim">Viewer</div>
              <p className="text-aura-text-dim">
                Read-only access to dashboard and agents
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <InviteMemberDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        onInvite={handleInvite}
      />
    </>
  );
}
