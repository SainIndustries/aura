import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { subscriptions, users, provisioningJobs, agents, agentInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { enqueueProvisioningJob, getJobByStripeEventId } from "@/lib/provisioning/queue";
import { triggerProvisioningWorkflow } from "@/lib/provisioning/github-actions";
import { destroyAgent, stopAgent } from "@/lib/provisioning/lifecycle";

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

        // 1. Existing: upsert subscription
        if (session.subscription && session.customer) {
          const sub = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          await upsertSubscription(sub);
        }

        // 2. NEW: Queue provisioning job (idempotent)
        // NOTE: This code is currently dormant. The current business model uses
        // subscription-gated provisioning (user subscribes in Settings, then can
        // deploy unlimited agents via Deploy button). This agentId metadata flow
        // is reserved for future per-agent billing if the business model changes.
        const agentId = session.metadata?.agentId;
        const userId = session.metadata?.userId;
        const region = session.metadata?.region || "us-east";

        if (agentId && userId) {
          // Idempotency check: has this Stripe event already been processed?
          const existingJob = await getJobByStripeEventId(event.id);
          if (existingJob) {
            console.log(`[Stripe Webhook] Event ${event.id} already processed, skipping`);
            break;
          }

          try {
            // Enqueue the provisioning job
            const job = await enqueueProvisioningJob({
              agentId,
              userId,
              stripeEventId: event.id,
              region,
            });

            console.log(`[Stripe Webhook] Provisioning job ${job.id} queued for agent ${agentId}`);

            // Trigger GitHub Actions workflow (non-blocking try/catch)
            // If this fails, job stays "queued" and can be retried
            try {
              await triggerProvisioningWorkflow(job);
            } catch (triggerError) {
              console.error(`[Stripe Webhook] Failed to trigger workflow for job ${job.id}:`, triggerError);
              // Job stays queued — user can retry from dashboard (Phase 10)
              // Do NOT fail the webhook response — job is already saved
            }
          } catch (queueError) {
            // Log but don't fail webhook — may be concurrent provision error
            console.error(`[Stripe Webhook] Failed to queue provisioning:`, queueError);
          }
        }

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
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

        if (!customerId) {
          console.warn("[Stripe Webhook] No customer ID in subscription.deleted event");
          break;
        }

        const user = await db.query.users.findFirst({
          where: eq(users.stripeCustomerId, customerId),
        });

        if (!user) {
          console.warn(
            `[Stripe Webhook] No user found for Stripe customer ${customerId}`
          );
          break;
        }

        // Find all agents with running instances for this user
        const userAgents = await db.query.agents.findMany({
          where: eq(agents.userId, user.id),
          with: { instances: true },
        });

        // Destroy each agent that has a running instance with serverId
        for (const agent of userAgents) {
          const runningInstance = agent.instances?.find(
            (instance) =>
              instance.status === "running" && instance.serverId
          );

          if (runningInstance) {
            try {
              await destroyAgent(agent.id);
              console.log(
                `[Stripe Webhook] Destroyed agent ${agent.id} due to subscription cancellation`
              );
            } catch (error) {
              console.error(
                `[Stripe Webhook] Failed to destroy agent ${agent.id}:`,
                error
              );
              // Continue with next agent
            }
          }
        }

        break;
      }

      case "invoice.paid": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string | null;
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          await upsertSubscription(sub);
        }
        break;
      }

      case "invoice.payment_failed": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string | null;
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          await upsertSubscription(sub);
        }

        // Suspend all running agents for this customer
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;

        if (!customerId) {
          console.warn(
            "[Stripe Webhook] No customer ID in invoice.payment_failed event"
          );
          break;
        }

        const user = await db.query.users.findFirst({
          where: eq(users.stripeCustomerId, customerId),
        });

        if (!user) {
          console.warn(
            `[Stripe Webhook] No user found for Stripe customer ${customerId}`
          );
          break;
        }

        // Find all agents with running instances for this user
        const userAgents = await db.query.agents.findMany({
          where: eq(agents.userId, user.id),
          with: { instances: true },
        });

        // Suspend (stop) each agent that has a running instance with serverId
        for (const agent of userAgents) {
          const runningInstance = agent.instances?.find(
            (instance) =>
              instance.status === "running" && instance.serverId
          );

          if (runningInstance) {
            try {
              await stopAgent(agent.id);
              console.log(
                `[Stripe Webhook] Suspended agent ${agent.id} due to payment failure`
              );
            } catch (error) {
              console.error(
                `[Stripe Webhook] Failed to suspend agent ${agent.id}:`,
                error
              );
              // Continue with next agent
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
