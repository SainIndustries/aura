import { db } from "../src/lib/db";
import { provisioningJobs, agentInstances, agents } from "../src/lib/db/schema";
import { desc } from "drizzle-orm";

async function main() {
  console.log("=== Recent Provisioning Jobs ===");
  const jobs = await db.query.provisioningJobs.findMany({
    orderBy: [desc(provisioningJobs.createdAt)],
    limit: 5,
  });
  
  for (const job of jobs) {
    console.log(`Job ${job.id.slice(0,8)}: status=${job.status}, agent=${job.agentId.slice(0,8)}, created=${job.createdAt.toISOString()}`);
    if (job.error) console.log(`  Error: ${job.error}`);
  }

  console.log("\n=== Recent Agent Instances ===");
  const instances = await db.query.agentInstances.findMany({
    orderBy: [desc(agentInstances.createdAt)],
    limit: 5,
  });

  for (const inst of instances) {
    console.log(`Instance ${inst.id.slice(0,8)}: status=${inst.status}, agent=${inst.agentId.slice(0,8)}, server=${inst.serverId || 'none'}`);
    if (inst.error) console.log(`  Error: ${inst.error}`);
  }

  console.log("\n=== Recent Agents ===");
  const agentsList = await db.query.agents.findMany({
    orderBy: [desc(agents.createdAt)],
    limit: 5,
  });

  for (const agent of agentsList) {
    console.log(`Agent ${agent.id.slice(0,8)}: name="${agent.name}", status=${agent.status}`);
  }

  process.exit(0);
}

main().catch(console.error);
