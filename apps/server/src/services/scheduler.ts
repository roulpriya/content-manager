import cron from "node-cron";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { posts, type PostTopic } from "../db/schema.js";
import { createAndGenerate } from "./post.js";
import {
  fetchRecentGitHubActivity,
  type GitHubActivitySnapshot,
} from "./github.js";

const SEED_TOPICS = [
  "Why code reviews matter more than you think",
  "The real cost of technical debt",
  "When to use a monorepo vs multiple repos",
  "Why most abstractions are premature",
  "The difference between senior and junior developers",
];

async function runBatchGeneration() {
  console.log(`[scheduler] Running batch generation at ${new Date().toISOString()}`);

  const ideas = await db
    .select()
    .from(posts)
    .where(eq(posts.status, "idea"))
    .limit(3);

  const toGenerate =
    ideas.length > 0
      ? ideas.map((p) => ({
          input: p.input,
          type: p.type as "tweet" | "thread",
          topic: (p.topic ?? "general") as PostTopic,
        }))
      : SEED_TOPICS.slice(0, 3).map((topic) => ({
          input: topic,
          type: "tweet" as const,
          topic: "general" as const,
        }));

  let count = 0;
  for (const item of toGenerate) {
    try {
      await createAndGenerate(item.input, item.type, item.topic);
      count++;
    } catch (err) {
      console.error(`[scheduler] Failed to generate post:`, err);
    }
  }

  console.log(`[scheduler] Generated ${count} posts`);
}

function buildGitHubPostInput(activity: GitHubActivitySnapshot): string {
  const lines: string[] = [];
  if (activity.commits.length > 0) {
    lines.push("Recent commits:");
    for (const c of activity.commits.slice(0, 3)) {
      lines.push(`- [${c.repo}] ${c.message}`);
    }
  }
  if (activity.pullRequests.length > 0) {
    lines.push("Recent PRs:");
    for (const pr of activity.pullRequests.slice(0, 3)) {
      lines.push(`- [${pr.repo}] #${pr.number} "${pr.title}" (${pr.state})`);
    }
  }
  return lines.join("\n");
}

export async function runGitHubPost() {
  if (!process.env.GITHUB_TOKEN?.trim()) return;

  console.log("[scheduler] Checking recent GitHub activity...");

  let activity: GitHubActivitySnapshot;
  try {
    activity = await fetchRecentGitHubActivity(1, {
      repositories: 5,
      pullRequests: 5,
      commits: 10,
    });
  } catch (err) {
    console.error("[scheduler] GitHub activity fetch failed, skipping:", err);
    return;
  }

  const hasMeaningfulActivity =
    activity.commits.length > 0 || activity.pullRequests.length > 0;

  if (!hasMeaningfulActivity) {
    console.log("[scheduler] No recent GitHub activity, skipping post.");
    return;
  }

  try {
    await createAndGenerate(buildGitHubPostInput(activity), "tweet", "github-daily");
    console.log("[scheduler] GitHub activity post generated.");
  } catch (err) {
    console.error("[scheduler] Failed to generate GitHub activity post:", err);
  }
}

export function startScheduler() {
  cron.schedule("0 8 * * *", async () => {
    await runBatchGeneration();
    await runGitHubPost();
  });
  console.log("[scheduler] Daily job scheduled at 08:00");
}
