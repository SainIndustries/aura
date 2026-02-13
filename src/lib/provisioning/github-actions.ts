import { provisioningJobs } from "@/lib/db/schema";

interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  callbackSecret: string;
  appUrl: string;
}

function getGitHubConfig(): GitHubConfig {
  const token = process.env.GITHUB_PAT;
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const callbackSecret = process.env.GITHUB_CALLBACK_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!token || !owner || !repo || !callbackSecret || !appUrl) {
    throw new Error(
      "Missing GitHub Actions configuration. Required: GITHUB_PAT, GITHUB_REPO_OWNER, GITHUB_REPO_NAME, GITHUB_CALLBACK_SECRET, NEXT_PUBLIC_APP_URL"
    );
  }

  return { token, owner, repo, callbackSecret, appUrl };
}

/**
 * Trigger GitHub Actions workflow_dispatch for provisioning job
 * @param job - The provisioning job record from database
 * @returns Promise<void>
 * @throws Error if GitHub API call fails
 */
export async function triggerProvisioningWorkflow(
  job: typeof provisioningJobs.$inferSelect
): Promise<void> {
  const { token, owner, repo, callbackSecret, appUrl } = getGitHubConfig();

  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/provision-agent.yml/dispatches`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ref: "main",
      inputs: {
        job_id: job.id,
        agent_id: job.agentId,
        region: job.region,
        callback_url: `${appUrl}/api/webhooks/github`,
      },
    }),
  });

  if (response.status !== 204) {
    throw new Error(
      `GitHub Actions workflow dispatch failed: ${response.status} ${response.statusText}`
    );
  }

  console.log(
    `[GitHub Actions] Triggered provisioning workflow for job ${job.id}`
  );
}
