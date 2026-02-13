"use client";

import { usePrivy } from "@privy-io/react-auth";
import { CreditCard, CheckCircle, AlertTriangle, XCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard/page-header";
import { createCheckoutSession, createCustomerPortalSession } from "@/lib/actions/stripe";

interface SettingsClientProps {
  email: string | null;
  userId: string | null;
  subscription: {
    status: string;
    isTrialing: boolean;
    trialDaysRemaining: number;
    isActive: boolean;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string | null;
  } | null;
}

export function SettingsClient({ email, userId, subscription }: SettingsClientProps) {
  const { user } = usePrivy();
  const displayEmail = email ?? user?.email?.address ?? "—";
  const displayId = userId ?? user?.id ?? "—";

  return (
    <div className="space-y-8">
      <PageHeader title="Settings" description="Manage your account" />

      <Card className="border-[rgba(255,255,255,0.05)] bg-aura-surface">
        <CardHeader>
          <CardTitle className="text-lg">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-aura-text-dim">Email</label>
            <p className="text-sm">{displayEmail}</p>
          </div>
          <div>
            <label className="text-sm text-aura-text-dim">User ID</label>
            <p className="font-mono text-sm text-aura-text-light">
              {displayId}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[rgba(255,255,255,0.05)] bg-aura-surface">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5" />
            Billing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!subscription ? (
            <>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-aura-text-dim/20 text-aura-text-dim">
                  No subscription
                </Badge>
              </div>
              <p className="text-sm text-aura-text-dim">
                Aura Pro — $299/month with a 14-day free trial. No charge today.
              </p>
              <form action={createCheckoutSession}>
                <Button type="submit">Start Free Trial</Button>
              </form>
            </>
          ) : subscription.isTrialing ? (
            <>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-aura-accent/20 text-aura-accent">
                  <Clock className="mr-1 h-3 w-3" />
                  Trialing
                </Badge>
                <span className="text-sm text-aura-text-light">
                  {subscription.trialDaysRemaining} days remaining
                </span>
              </div>
              <p className="text-sm text-aura-text-dim">
                Your trial is active. You&apos;ll be charged $299/month when it ends.
              </p>
              <form action={createCustomerPortalSession}>
                <Button type="submit" variant="outline">Manage Billing</Button>
              </form>
            </>
          ) : subscription.status === "active" ? (
            <>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-aura-mint/20 text-aura-mint">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Active
                </Badge>
                {subscription.cancelAtPeriodEnd && (
                  <span className="text-sm text-aura-amber">
                    Cancels at period end
                  </span>
                )}
              </div>
              {subscription.currentPeriodEnd && (
                <p className="text-sm text-aura-text-dim">
                  Next billing date:{" "}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              )}
              <form action={createCustomerPortalSession}>
                <Button type="submit" variant="outline">Manage Billing</Button>
              </form>
            </>
          ) : subscription.status === "past_due" ? (
            <>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-aura-amber/20 text-aura-amber">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  Past Due
                </Badge>
              </div>
              <p className="text-sm text-destructive">
                Your payment failed. Please update your billing information.
              </p>
              <form action={createCustomerPortalSession}>
                <Button type="submit">Update Payment Method</Button>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-destructive/20 text-destructive">
                  <XCircle className="mr-1 h-3 w-3" />
                  {subscription.status === "canceled" ? "Canceled" : subscription.status}
                </Badge>
              </div>
              <p className="text-sm text-aura-text-dim">
                Your subscription has been canceled. Re-subscribe to continue using Aura.
              </p>
              <form action={createCheckoutSession}>
                <Button type="submit">Re-subscribe</Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
