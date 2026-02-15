import { db } from "../src/lib/db";
import { provisioningJobs, agentInstances } from "../src/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

async function main() {
  // Clear stuck jobs
  console.log("=== Clearing stuck provisioning jobs ===");
  const stuckJobs = await db.query.provisioningJobs.findMany({
    where: inArray(provisioningJobs.status, ["queued", "provisioning"]),
  });
  
  for (const job of stuckJobs) {
    await db.update(provisioningJobs)
      .set({ status: "failed", error: "Workflow failed - cleared for retry", updatedAt: new Date() })
      .where(eq(provisioningJobs.id, job.id));
    console.log(`Cleared job ${job.id.slice(0,8)}`);
  }

  // Clear stuck instances
  console.log("\n=== Clearing stuck instances ===");
  const stuckInstances = await db.query.agentInstances.findMany({
    where: inArray(agentInstances.status, ["pending", "provisioning"]),
  });

  for (const inst of stuckInstances) {
    await db.update(agentInstances)
      .set({ status: "failed", error: "Workflow failed - cleared for retry", updatedAt: new Date() })
      .where(eq(agentInstances.id, inst.id));
    console.log(`Cleared instance ${inst.id.slice(0,8)}`);
  }

  console.log("\nDone! You can now retry provisioning.");
  process.exit(0);
}

main().catch(console.error);
