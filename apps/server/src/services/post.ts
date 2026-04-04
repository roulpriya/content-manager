import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { posts, type Post } from "../db/schema.js";
import { generateContent } from "./content.js";

export async function createAndGenerate(
  input: string,
  type: "tweet" | "thread"
): Promise<Post> {
  const ts = Date.now();
  const [post] = await db
    .insert(posts)
    .values({ input, type, status: "idea", createdAt: ts, updatedAt: ts })
    .returning();

  const { title, body } = await generateContent(input, type);

  const [updated] = await db
    .update(posts)
    .set({ title, body, status: "generated", updatedAt: Date.now() })
    .where(eq(posts.id, post!.id))
    .returning();

  return updated!;
}

export async function regenerate(id: number, feedback?: string): Promise<Post> {
  const [post] = await db.select().from(posts).where(eq(posts.id, id));
  if (!post) throw new Error(`Post ${id} not found`);

  const { title, body } = await generateContent(post.input, post.type, feedback);

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
  return updated;
}

export async function deletePost(id: number): Promise<void> {
  await db.delete(posts).where(eq(posts.id, id));
}
