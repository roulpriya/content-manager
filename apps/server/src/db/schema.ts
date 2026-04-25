import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const POST_TOPICS = [
  "day-schedule",
  "gym-routine",
  "llm-project",
  "new-tech-stack",
  "ui-product-demo",
  "general",
] as const;

export type PostTopic = (typeof POST_TOPICS)[number];

export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  input: text("input").notNull(),
  title: text("title"),
  body: text("body"),
  type: text("type", { enum: ["tweet", "thread"] }).notNull(),
  topic: text("topic", { enum: POST_TOPICS }).notNull().default("general"),
  status: text("status", { enum: ["idea", "generated", "accepted", "published", "rejected"] })
    .notNull()
    .default("idea"),
  scheduledFor: integer("scheduled_for").notNull(),
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

export const memories = sqliteTable(
  "memories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourcePostId: integer("source_post_id").notNull(),
    input: text("input").notNull(),
    title: text("title"),
    body: text("body").notNull(),
    topic: text("topic", { enum: POST_TOPICS }).notNull(),
    type: text("type", { enum: ["tweet", "thread"] }).notNull(),
    searchableText: text("searchable_text").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => ({
    sourcePostIdIdx: uniqueIndex("memories_source_post_id_idx").on(table.sourcePostId),
  })
);

export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;

export const articles = sqliteTable("articles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  topic: text("topic").notNull(),
  status: text("status", { enum: ["researching", "writing", "done", "error"] })
    .notNull()
    .default("researching"),
  researchSummary: text("research_summary"),
  title: text("title"),
  body: text("body"),
  wordCount: integer("word_count"),
  errorMessage: text("error_message"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
