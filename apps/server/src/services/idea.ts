import { desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { ideas, type Idea } from "../db/schema.js";
import { enrichIdea } from "./research.js";

export async function createIdea(topic: string, notes?: string): Promise<Idea> {
  const ts = Date.now();
  const [idea] = await db
    .insert(ideas)
    .values({ topic, notes, status: "pending", createdAt: ts, updatedAt: ts })
    .returning();
  return idea!;
}

export async function listIdeas(): Promise<Idea[]> {
  return db.select().from(ideas).orderBy(desc(ideas.createdAt));
}

export async function deleteIdea(id: number): Promise<void> {
  await db.delete(ideas).where(eq(ideas.id, id));
}

export async function startEnrichment(id: number): Promise<void> {
  const [idea] = await db.select().from(ideas).where(eq(ideas.id, id));
  if (!idea) throw new Error(`Idea ${id} not found`);

  await db
    .update(ideas)
    .set({ status: "enriching", updatedAt: Date.now() })
    .where(eq(ideas.id, id));

  // Fire and forget
  (async () => {
    try {
      const content = await enrichIdea(idea.topic);
      await db
        .update(ideas)
        .set({
          status: "enriched",
          enrichedContent: JSON.stringify(content),
          updatedAt: Date.now(),
        })
        .where(eq(ideas.id, id));
    } catch (err) {
      await db
        .update(ideas)
        .set({
          status: "error",
          errorMessage: err instanceof Error ? err.message : String(err),
          updatedAt: Date.now(),
        })
        .where(eq(ideas.id, id));
    }
  })();
}
