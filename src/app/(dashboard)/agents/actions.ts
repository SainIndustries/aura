"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createAgentSchema } from "@/lib/validators/agent";
import { getUserSubscription } from "@/lib/subscription";
import { createCheckoutSession } from "@/lib/actions/stripe";

export async function createAgent(formData: unknown) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const parsed = createAgentSchema.parse(formData);

  const [agent] = await db.insert(agents).values({
    userId: user.id,
    name: parsed.name,
    description: parsed.description,
    personality: parsed.personality,
    goal: parsed.goal,
    heartbeatEnabled: parsed.heartbeatEnabled,
    heartbeatCron: parsed.heartbeatCron,
    status: "draft",
    config: {
      llmProvider: parsed.llmProvider,
      llmModel: parsed.llmModel,
      llmTemperature: parsed.llmTemperature,
      llmCustomEndpoint: parsed.llmCustomEndpoint,
    },
  }).returning();

  // If user has active subscription, skip Stripe and go straight to deploying
  // If not, route to Stripe checkout (which redirects back to deploying on success)
  const subscription = await getUserSubscription(user.id);
  if (subscription?.isActive) {
    redirect(`/onboarding?agentId=${agent.id}&success=true`);
  } else {
    await createCheckoutSession(agent.id);
  }
}

export async function updateAgent(id: string, formData: unknown) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const parsed = createAgentSchema.parse(formData);

  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, id), eq(agents.userId, user.id)),
  });

  if (!agent) throw new Error("Agent not found");

  await db
    .update(agents)
    .set({
      name: parsed.name,
      description: parsed.description,
      personality: parsed.personality,
      goal: parsed.goal,
      heartbeatEnabled: parsed.heartbeatEnabled,
      heartbeatCron: parsed.heartbeatCron,
      config: {
        llmProvider: parsed.llmProvider,
        llmModel: parsed.llmModel,
        llmTemperature: parsed.llmTemperature,
        llmCustomEndpoint: parsed.llmCustomEndpoint,
      },
      updatedAt: new Date(),
    })
    .where(eq(agents.id, id));

  redirect(`/agents/${id}`);
}

export async function toggleAgentStatus(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, id), eq(agents.userId, user.id)),
  });

  if (!agent) throw new Error("Agent not found");

  const newStatus = agent.status === "active" ? "paused" : "active";

  await db
    .update(agents)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(agents.id, id));

  revalidatePath("/agents");
  revalidatePath(`/agents/${id}`);
}

export async function deleteAgent(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, id), eq(agents.userId, user.id)),
  });

  if (!agent) throw new Error("Agent not found");

  await db.delete(agents).where(eq(agents.id, id));

  redirect("/agents");
}
