import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  input: text("input").notNull(),
  title: text("title"),
  body: text("body"),
  type: text("type", { enum: ["tweet", "thread"] }).notNull(),
  status: text("status", { enum: ["idea", "generated", "approved", "posted"] })
    .notNull()
    .default("idea"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;

export const ideas = sqliteTable("ideas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  topic: text("topic").notNull(),
  notes: text("notes"),
  status: text("status", { enum: ["pending", "enriching", "enriched", "error"] })
    .notNull()
    .default("pending"),
  enrichedContent: text("enriched_content"),
  errorMessage: text("error_message"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export type Idea = typeof ideas.$inferSelect;
export type NewIdea = typeof ideas.$inferInsert;
