import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { channels, users, agents } from "@/lib/db/schema";
import { getPrivyClient } from "@/lib/privy";
import { PageHeader } from "@/components/dashboard/page-header";
import { ChannelsClient } from "./channels-client";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("privy-token")?.value;

  if (!token) {
    return null;
  }

  try {
    const privy = getPrivyClient();
    const verifiedClaims = await privy.verifyAuthToken(token);
    
    const user = await db.query.users.findFirst({
      where: eq(users.privyUserId, verifiedClaims.userId),
    });

    return user;
  } catch {
    return null;
  }
}

export default async function ChannelsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const userChannels = await db.query.channels.findMany({
    where: eq(channels.userId, user.id),
    with: {
      agent: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: (channels, { desc }) => [desc(channels.createdAt)],
  });

  const userAgents = await db.query.agents.findMany({
    where: eq(agents.userId, user.id),
    columns: {
      id: true,
      name: true,
    },
    orderBy: (agents, { asc }) => [asc(agents.name)],
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Channels"
        description="Connect your agents to messaging platforms"
      />

      <ChannelsClient
        initialChannels={userChannels}
        agents={userAgents}
      />
    </div>
  );
}
