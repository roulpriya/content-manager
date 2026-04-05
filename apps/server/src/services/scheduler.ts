import cron from "node-cron";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { posts, type PostTopic } from "../db/schema.js";
import { createAndGenerate } from "./post.js";

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

export function startScheduler() {
  cron.schedule("0 8 * * *", runBatchGeneration);
  console.log("[scheduler] Daily job scheduled at 08:00");
}
