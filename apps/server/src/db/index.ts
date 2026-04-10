import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "fs";
import { ideas, memories, posts } from "./schema.js";

const DB_PATH = "./data/content.db";

mkdirSync("./data", { recursive: true });

const sqlite = new Database(DB_PATH);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    input TEXT NOT NULL,
    title TEXT,
    body TEXT,
    type TEXT NOT NULL,
    topic TEXT NOT NULL DEFAULT 'general',
    status TEXT NOT NULL DEFAULT 'idea',
    scheduled_for INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    enriched_content TEXT,
    error_message TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_post_id INTEGER NOT NULL UNIQUE,
    input TEXT NOT NULL,
    title TEXT,
    body TEXT NOT NULL,
    topic TEXT NOT NULL,
    type TEXT NOT NULL,
    searchable_text TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS memory_data_dictionary (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

const postColumns = sqlite
  .prepare("PRAGMA table_info(posts)")
  .all() as Array<{ name: string }>;

if (!postColumns.some((column) => column.name === "topic")) {
  sqlite.exec(
    "ALTER TABLE posts ADD COLUMN topic TEXT NOT NULL DEFAULT 'general';"
  );
}

if (!postColumns.some((column) => column.name === "scheduled_for")) {
  sqlite.exec(
    "ALTER TABLE posts ADD COLUMN scheduled_for INTEGER NOT NULL DEFAULT 0;"
  );
  sqlite.exec("UPDATE posts SET scheduled_for = created_at WHERE scheduled_for = 0;");
}

sqlite.exec(`
  UPDATE posts SET status = 'accepted' WHERE status = 'approved';
  UPDATE posts SET status = 'published' WHERE status = 'posted';
`);

const now = Date.now();
const dictionaryRows = [
  {
    key: "memories.table",
    value:
      "Table memories stores approved-post memory records. Columns: id, source_post_id, input, title, body, topic, type, searchable_text, created_at, updated_at.",
  },
  {
    key: "memory.tools.read",
    value:
      "Read tool supports dictionary lookup, listing recent memories, fetching a memory by id, and keyword search filtered by topic.",
  },
  {
    key: "memory.tools.write",
    value:
      "Write tool supports saving or upserting memory rows, deleting a memory row, and syncing approved posts into memory storage.",
  },
];

const upsertDictionary = sqlite.prepare(`
  INSERT INTO memory_data_dictionary (key, value, updated_at)
  VALUES (@key, @value, @updatedAt)
  ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = excluded.updated_at
`);

for (const row of dictionaryRows) {
  upsertDictionary.run({ ...row, updatedAt: now });
}

export const db = drizzle(sqlite, { schema: { posts, ideas, memories } });
export const rawSqlite = sqlite as any;
