"use server";

import { redirect } from "next/navigation";
import { getStripe } from "@/lib/stripe";
import { getCurrentUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { TOKEN_PACKAGES, type TokenPackageId } from "@/lib/billing/token-packages";

export async function createCheckoutSession(agentId?: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const stripe = getStripe();

  // Create or reuse Stripe customer
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { userId: user.id, privyUserId: user.privyUserId },
    });
    customerId = customer.id;
    await db
      .update(users)
      .set({ stripeCustomerId: customerId, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  }

  const successUrl = agentId
    ? `${process.env.NEXT_PUBLIC_APP_URL}/onboarding?agentId=${agentId}&success=true`
    : `${process.env.NEXT_PUBLIC_APP_URL}/settings?success=true`;
  const cancelUrl = agentId
    ? `${process.env.NEXT_PUBLIC_APP_URL}/onboarding`
    : `${process.env.NEXT_PUBLIC_APP_URL}/settings?canceled=true`;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [
      {
        price: process.env.STRIPE_PRICE_ID!,
        quantity: 1,
      },
    ],
    subscription_data: {
      trial_period_days: 7,
    },
    metadata: agentId ? { agentId, userId: user.id } : undefined,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  if (session.url) {
    redirect(session.url);
  }
}

export async function createTopUpCheckout(packageId: TokenPackageId) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  if (!user.stripeCustomerId) {
    throw new Error("No billing account. Subscribe first.");
  }

  const pkg = TOKEN_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) throw new Error("Invalid package");

  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    customer: user.stripeCustomerId,
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Aura ${pkg.name}`,
            description: `${pkg.description} token top-up`,
          },
          unit_amount: pkg.priceCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: "token_topup",
      package_id: pkg.id,
      tokens: String(pkg.tokens),
      user_id: user.id,
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?topup=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?topup=canceled`,
  });

  if (session.url) {
    redirect(session.url);
  }
}

export async function createCustomerPortalSession() {
  const user = await getCurrentUser();
  if (!user?.stripeCustomerId) throw new Error("No billing account");

  const stripe = getStripe();

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
  });

  redirect(session.url);
}
