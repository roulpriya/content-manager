import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { posts, type Post, type PostTopic } from "../db/schema.js";
import { generateCalendarContent, generateContent } from "./content.js";
import { deleteMemoryBySourcePostId, saveApprovedPostToMemory } from "./memory.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(ts: number): number {
  const date = new Date(ts);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export async function createAndGenerate(
  input: string,
  type: "tweet" | "thread",
  topic: PostTopic,
  scheduledFor = Date.now()
): Promise<Post> {
  const ts = Date.now();
  const [post] = await db
    .insert(posts)
    .values({
      input,
      type,
      topic,
      status: "idea",
      scheduledFor,
      createdAt: ts,
      updatedAt: ts,
    })
    .returning();

  const { title, body } = await generateContent(input, type, topic);

  const [updated] = await db
    .update(posts)
    .set({ title, body, status: "generated", updatedAt: Date.now() })
    .where(eq(posts.id, post!.id))
    .returning();

  return updated!;
}

export async function createCalendar(
  input: string,
  type: "tweet" | "thread",
  topic: PostTopic,
  days: number,
  startDate = Date.now()
): Promise<Post[]> {
  const normalizedStart = startOfDay(startDate);
  const created: Post[] = [];

  for (let i = 0; i < days; i += 1) {
    const scheduledFor = normalizedStart + i * DAY_MS;
    const ts = Date.now();
    const [post] = await db
      .insert(posts)
      .values({
        input,
        type,
        topic,
        status: "idea",
        scheduledFor,
        createdAt: ts,
        updatedAt: ts,
      })
      .returning();

    const { title, body } = await generateCalendarContent(
      input,
      type,
      topic,
      i + 1,
      days,
      scheduledFor
    );

    const [updated] = await db
      .update(posts)
      .set({ title, body, status: "generated", updatedAt: Date.now() })
      .where(eq(posts.id, post!.id))
      .returning();

    created.push(updated!);
  }

  return created;
}

export async function regenerate(id: number, feedback?: string): Promise<Post> {
  const [post] = await db.select().from(posts).where(eq(posts.id, id));
  if (!post) throw new Error(`Post ${id} not found`);

  const { title, body } = await generateContent(
    post.input,
    post.type,
    post.topic,
    feedback
  );

  const [updated] = await db
    .update(posts)
    .set({ title, body, status: "generated", updatedAt: Date.now() })
    .where(eq(posts.id, id))
    .returning();

  return updated!;
}

export async function listPosts(status?: string): Promise<Post[]> {
  if (status) {
    return db
      .select()
      .from(posts)
      .where(eq(posts.status, status as Post["status"]))
      .orderBy(posts.createdAt);
  }
  return db.select().from(posts).orderBy(posts.createdAt);
}

export async function updateStatus(
  id: number,
  status: Post["status"]
): Promise<Post> {
  const [updated] = await db
    .update(posts)
    .set({ status, updatedAt: Date.now() })
    .where(eq(posts.id, id))
    .returning();
  if (!updated) throw new Error(`Post ${id} not found`);
  if (status === "accepted" && updated.body) {
    await saveApprovedPostToMemory(updated);
  }
  if (status === "rejected") {
    await deleteMemoryBySourcePostId(updated.id);
  }
  return updated;
}

export async function updateTopic(
  id: number,
  topic: PostTopic
): Promise<Post> {
  const [updated] = await db
    .update(posts)
    .set({ topic, updatedAt: Date.now() })
    .where(eq(posts.id, id))
    .returning();
  if (!updated) throw new Error(`Post ${id} not found`);
  return updated;
}

export async function deletePost(id: number): Promise<void> {
  await db.delete(posts).where(eq(posts.id, id));
}
