import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "fs";
import { ideas, posts } from "./schema.js";

const APP_DB_PATH = "./data/content.db";
const MEMORY_DB_PATH = "./data/memory.db";

mkdirSync("./data", { recursive: true });

const appSqlite = new Database(APP_DB_PATH);
const memorySqlite = new Database(MEMORY_DB_PATH);

function initializeApplicationDatabase(sqlite: Database.Database) {
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
}

function initializeMemoryDatabase(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_post_id INTEGER NOT NULL UNIQUE,
      input TEXT NOT NULL,
      title TEXT,
      body TEXT NOT NULL,
      topic TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'generated',
      scheduled_for INTEGER NOT NULL DEFAULT 0,
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

  const memoryColumns = sqlite
    .prepare("PRAGMA table_info(memories)")
    .all() as Array<{ name: string }>;

  if (!memoryColumns.some((column) => column.name === "status")) {
    sqlite.exec(
      "ALTER TABLE memories ADD COLUMN status TEXT NOT NULL DEFAULT 'generated';"
    );
  }

  if (!memoryColumns.some((column) => column.name === "scheduled_for")) {
    sqlite.exec(
      "ALTER TABLE memories ADD COLUMN scheduled_for INTEGER NOT NULL DEFAULT 0;"
    );
  }

  const now = Date.now();
  const dictionaryRows = [
    {
      key: "memories.table",
      value:
        "Table memories stores one upserted memory snapshot per source post. Columns: id, source_post_id, input, title, body, topic, type, status, scheduled_for, searchable_text, created_at, updated_at.",
    },
    {
      key: "memory.agent.read",
      value:
        "Memory read agent is exposed to content-generation agents as a tool call. It should consult the data dictionary before making schema assumptions and return concise style/context summaries.",
    },
    {
      key: "memory.agent.write",
      value:
        "Memory write agent runs on post generation, approval, and scheduling. It upserts the latest memory snapshot for a source post and keeps the data dictionary aligned with memory semantics.",
    },
  {
    key: "memories.statuses",
    value:
      "Memory snapshots may reflect generated, accepted, published, or rejected post states. Content-generation agents should prefer accepted or published memories when inferring writing style.",
  },
  {
    key: "memory.tools.github",
    value:
      "GitHub read tool fetches recent repositories, pull requests, and commits for the configured GitHub account using GITHUB_TOKEN and optional GITHUB_USERNAME.",
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
}

function hasTable(sqlite: Database.Database, tableName: string): boolean {
  const row = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1"
    )
    .get(tableName) as { name: string } | undefined;

  return Boolean(row);
}

function migrateLegacyMemoryData(
  applicationSqlite: Database.Database,
  memorySqliteToPopulate: Database.Database
) {
  const memoryCount = (
    memorySqliteToPopulate
      .prepare("SELECT COUNT(*) AS count FROM memories")
      .get() as { count: number }
  ).count;

  if (memoryCount > 0 || !hasTable(applicationSqlite, "memories")) {
    return;
  }

  const legacyMemoryColumns = applicationSqlite
    .prepare("PRAGMA table_info(memories)")
    .all() as Array<{ name: string }>;
  const hasLegacyMemoryColumn = (columnName: string) =>
    legacyMemoryColumns.some((column) => column.name === columnName);

  const legacyMemories = applicationSqlite
    .prepare(`
      SELECT
        source_post_id,
        input,
        title,
        body,
        topic,
        type,
        ${
          hasLegacyMemoryColumn("status")
            ? "COALESCE(status, 'generated')"
            : "'generated'"
        } AS status,
        ${
          hasLegacyMemoryColumn("scheduled_for")
            ? "COALESCE(scheduled_for, 0)"
            : "0"
        } AS scheduled_for,
        searchable_text,
        created_at,
        updated_at
      FROM memories
    `)
    .all() as Array<{
      source_post_id: number;
      input: string;
      title: string | null;
      body: string;
      topic: string;
      type: string;
      status: string;
      scheduled_for: number;
      searchable_text: string;
      created_at: number;
      updated_at: number;
    }>;

  const insertMemory = memorySqliteToPopulate.prepare(`
    INSERT INTO memories (
      source_post_id, input, title, body, topic, type, status, scheduled_for, searchable_text, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_post_id) DO UPDATE SET
      input = excluded.input,
      title = excluded.title,
      body = excluded.body,
      topic = excluded.topic,
      type = excluded.type,
      status = excluded.status,
      scheduled_for = excluded.scheduled_for,
      searchable_text = excluded.searchable_text,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at
  `);

  const insertDictionary = memorySqliteToPopulate.prepare(`
    INSERT INTO memory_data_dictionary (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `);

  const migrate = memorySqliteToPopulate.transaction(() => {
    for (const memory of legacyMemories) {
      insertMemory.run(
        memory.source_post_id,
        memory.input,
        memory.title,
        memory.body,
        memory.topic,
        memory.type,
        memory.status,
        memory.scheduled_for,
        memory.searchable_text,
        memory.created_at,
        memory.updated_at
      );
    }

    if (!hasTable(applicationSqlite, "memory_data_dictionary")) {
      return;
    }

    const dictionaryRows = applicationSqlite
      .prepare(`
        SELECT key, value, updated_at
        FROM memory_data_dictionary
      `)
      .all() as Array<{ key: string; value: string; updated_at: number }>;

    for (const row of dictionaryRows) {
      insertDictionary.run(row.key, row.value, row.updated_at);
    }
  });

  migrate();
}

initializeApplicationDatabase(appSqlite);
initializeMemoryDatabase(memorySqlite);
migrateLegacyMemoryData(appSqlite, memorySqlite);
export const db = drizzle(appSqlite, { schema: { posts, ideas } });
export const rawAppSqlite = appSqlite as any;
export const rawMemorySqlite = memorySqlite as any;
