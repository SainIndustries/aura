import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { subscriptions, users, tokenTopUps, agents, agentInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { grantTokens } from "@/lib/billing/token-guard";
import { MONTHLY_TOKEN_ALLOCATION } from "@/lib/billing/token-packages";
import { stopAgentInstance } from "@/lib/provisioning";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Handle subscription checkout
        if (session.subscription && session.customer) {
          const sub = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          await upsertSubscription(sub);

          // Grant initial monthly tokens
          const customerId =
            typeof session.customer === "string"
              ? session.customer
              : null;
          const user = customerId
            ? await db.query.users.findFirst({
                where: eq(users.stripeCustomerId, customerId),
              })
            : null;
          if (user) {
            await grantTokens(user.id, MONTHLY_TOKEN_ALLOCATION, true);
            console.log(
              `[Billing] Granted ${MONTHLY_TOKEN_ALLOCATION} tokens to user ${user.id} (new subscription)`
            );
          }
        }

        // Handle token top-up checkout
        if (
          session.mode === "payment" &&
          session.metadata?.type === "token_topup"
        ) {
          const userId = session.metadata.user_id;
          const tokens = parseInt(session.metadata.tokens, 10);
          const packageId = session.metadata.package_id;

          if (userId && tokens > 0) {
            await grantTokens(userId, tokens, false);

            await db.insert(tokenTopUps).values({
              userId,
              stripeSessionId: session.id,
              tokensAdded: tokens,
              amountPaid: session.amount_total ?? 0,
              packageId,
            });

            console.log(
              `[Billing] Top-up: added ${tokens} tokens for user ${userId} (${packageId})`
            );
          }
        }

        // NOTE: Provisioning is handled by the onboarding UI after Stripe redirect.
        // The webhook only handles subscription/billing state.

        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await upsertSubscription(sub);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await upsertSubscription(sub);

        // Destroy all running agents for this customer
        const deletedCustomerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

        if (!deletedCustomerId) {
          console.warn("[Stripe Webhook] No customer ID in subscription.deleted event");
          break;
        }

        const deletedUser = await db.query.users.findFirst({
          where: eq(users.stripeCustomerId, deletedCustomerId),
        });

        if (!deletedUser) {
          console.warn(
            `[Stripe Webhook] No user found for Stripe customer ${deletedCustomerId}`
          );
          break;
        }

        const deletedUserAgents = await db.query.agents.findMany({
          where: eq(agents.userId, deletedUser.id),
          with: { instances: true },
        });

        for (const agent of deletedUserAgents) {
          const runningInstance = agent.instances?.find(
            (instance) =>
              instance.status === "running" && instance.serverId
          );

          if (runningInstance) {
            try {
              await stopAgentInstance(agent.id);
              console.log(
                `[Stripe Webhook] Stopped agent ${agent.id} due to subscription cancellation`
              );
            } catch (error) {
              console.error(
                `[Stripe Webhook] Failed to stop agent ${agent.id}:`,
                error
              );
            }
          }
        }

        break;
      }

      case "invoice.paid": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const paidInvoice = event.data.object as any;
        const paidSubId = paidInvoice.subscription as string | null;
        if (paidSubId) {
          const sub = await stripe.subscriptions.retrieve(paidSubId);
          await upsertSubscription(sub);

          // Grant monthly tokens on renewal (not the first invoice — that's
          // handled by checkout.session.completed)
          const billingReason = paidInvoice.billing_reason as string | null;
          if (billingReason === "subscription_cycle") {
            const customerId =
              typeof sub.customer === "string"
                ? sub.customer
                : (sub.customer as { id: string })?.id;
            if (customerId) {
              const user = await db.query.users.findFirst({
                where: eq(users.stripeCustomerId, customerId),
              });
              if (user) {
                await grantTokens(user.id, MONTHLY_TOKEN_ALLOCATION, true);
                console.log(
                  `[Billing] Monthly renewal: reset ${MONTHLY_TOKEN_ALLOCATION} tokens for user ${user.id}`
                );
              }
            }
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const failedInvoice = event.data.object as any;
        const failedSubId = failedInvoice.subscription as string | null;
        if (failedSubId) {
          const sub = await stripe.subscriptions.retrieve(failedSubId);
          await upsertSubscription(sub);
        }

        // Suspend all running agents for this customer
        const failedCustomerId =
          typeof failedInvoice.customer === "string"
            ? failedInvoice.customer
            : failedInvoice.customer?.id;

        if (!failedCustomerId) {
          console.warn(
            "[Stripe Webhook] No customer ID in invoice.payment_failed event"
          );
          break;
        }

        const failedUser = await db.query.users.findFirst({
          where: eq(users.stripeCustomerId, failedCustomerId),
        });

        if (!failedUser) {
          console.warn(
            `[Stripe Webhook] No user found for Stripe customer ${failedCustomerId}`
          );
          break;
        }

        const failedUserAgents = await db.query.agents.findMany({
          where: eq(agents.userId, failedUser.id),
          with: { instances: true },
        });

        for (const agent of failedUserAgents) {
          const runningInstance = agent.instances?.find(
            (instance) =>
              instance.status === "running" && instance.serverId
          );

          if (runningInstance) {
            try {
              await stopAgentInstance(agent.id);
              console.log(
                `[Stripe Webhook] Suspended agent ${agent.id} due to payment failure`
              );
            } catch (error) {
              console.error(
                `[Stripe Webhook] Failed to suspend agent ${agent.id}:`,
                error
              );
            }
          }
        }

        break;
      }
    }
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertSubscription(sub: any) {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

  if (!customerId) return;

  const user = await db.query.users.findFirst({
    where: eq(users.stripeCustomerId, customerId),
  });

  if (!user) {
    console.error("No user found for Stripe customer:", customerId);
    return;
  }

  const status = sub.status as
    | "trialing"
    | "active"
    | "past_due"
    | "canceled"
    | "unpaid";

  const existing = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.stripeSubscriptionId, sub.id),
  });

  const data = {
    userId: user.id,
    stripeSubscriptionId: sub.id as string,
    stripePriceId: (sub.items?.data?.[0]?.price?.id as string) ?? null,
    status,
    currentPeriodStart: sub.current_period_start
      ? new Date(sub.current_period_start * 1000)
      : null,
    currentPeriodEnd: sub.current_period_end
      ? new Date(sub.current_period_end * 1000)
      : null,
    trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(subscriptions)
      .set(data)
      .where(eq(subscriptions.stripeSubscriptionId, sub.id));
  } else {
    await db.insert(subscriptions).values(data);
  }
}
