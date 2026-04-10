import { MODEL, openai } from "../lib/llm.js";
import { rawSqlite } from "../db/index.js";
import type { Memory, Post, PostStatus, PostTopic } from "../db/schema.js";
import { fetchRecentGitHubActivity, formatGitHubActivityForPrompt } from "./github.js";

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "my",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "we",
  "with",
]);

type MemoryRow = {
  id: number;
  sourcePostId: number;
  input: string;
  title: string | null;
  body: string;
  topic: PostTopic;
  type: "tweet" | "thread";
  status: PostStatus;
  scheduledFor: number;
  searchableText: string;
  createdAt: number;
  updatedAt: number;
};

type DictionaryRow = {
  key: string;
  value: string;
  updatedAt: number;
};

type SaveMemoryInput = {
  sourcePostId?: number;
  input: string;
  title?: string | null;
  body: string;
  topic: PostTopic;
  type: "tweet" | "thread";
  status: PostStatus;
  scheduledFor?: number;
  createdAt?: number;
};

type RunSqlResult =
  | { kind: "rows"; rows: unknown[] }
  | { kind: "write"; changes: number; lastInsertRowid: number | bigint };

type MemoryWriteEvent = "prompted_post" | "approved_post" | "scheduled_post";

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function uniqueTokens(value: string): string[] {
  return [...new Set(tokenize(value))];
}

function buildSearchableText(post: Pick<Post, "input" | "title" | "body" | "topic" | "status">) {
  return [post.topic, post.status, post.title ?? "", post.input, post.body ?? ""].join(" ").trim();
}

function mapMemoryRow(row: MemoryRow): Memory {
  return row;
}

function buildMemoryPreview(memory: Memory) {
  const condensed = memory.body.replace(/\s+/g, " ").trim();
  return condensed.length > 220 ? `${condensed.slice(0, 217)}...` : condensed;
}

function formatDictionaryRows(rows: DictionaryRow[]): string {
  if (rows.length === 0) {
    return "Memory data dictionary is currently empty.";
  }

  return rows.map((entry) => `- ${entry.key}: ${entry.value}`).join("\n");
}

class MemoryStore {
  list(limit = 50): Memory[] {
    const rows = rawSqlite
      .prepare(`
        SELECT
          id,
          source_post_id AS sourcePostId,
          input,
          title,
          body,
          topic,
          type,
          status,
          scheduled_for AS scheduledFor,
          searchable_text AS searchableText,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM memories
        ORDER BY updated_at DESC
        LIMIT ?
      `)
      .all(limit) as MemoryRow[];

    return rows.map(mapMemoryRow);
  }

  getById(id: number): Memory | null {
    const row = rawSqlite
      .prepare(`
        SELECT
          id,
          source_post_id AS sourcePostId,
          input,
          title,
          body,
          topic,
          type,
          status,
          scheduled_for AS scheduledFor,
          searchable_text AS searchableText,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM memories
        WHERE id = ?
      `)
      .get(id) as MemoryRow | undefined;

    return row ? mapMemoryRow(row) : null;
  }

  delete(id: number): void {
    rawSqlite.prepare("DELETE FROM memories WHERE id = ?").run(id);
  }

  deleteBySourcePostId(sourcePostId: number): void {
    rawSqlite.prepare("DELETE FROM memories WHERE source_post_id = ?").run(sourcePostId);
  }

  search(query: string, topic?: PostTopic, limit = 10): Memory[] {
    const base = topic
      ? (rawSqlite
          .prepare(`
            SELECT
              id,
              source_post_id AS sourcePostId,
              input,
              title,
              body,
              topic,
              type,
              status,
              scheduled_for AS scheduledFor,
              searchable_text AS searchableText,
              created_at AS createdAt,
              updated_at AS updatedAt
            FROM memories
            WHERE topic = ? AND status != 'rejected'
            ORDER BY updated_at DESC
          `)
          .all(topic) as MemoryRow[])
      : (rawSqlite
          .prepare(`
            SELECT
              id,
              source_post_id AS sourcePostId,
              input,
              title,
              body,
              topic,
              type,
              status,
              scheduled_for AS scheduledFor,
              searchable_text AS searchableText,
              created_at AS createdAt,
              updated_at AS updatedAt
            FROM memories
            WHERE status != 'rejected'
            ORDER BY updated_at DESC
          `)
          .all() as MemoryRow[]);

    const queryTokens = uniqueTokens(query);
    if (queryTokens.length === 0) {
      return base.slice(0, limit).map(mapMemoryRow);
    }

    return base
      .map((memory) => {
        const memoryTokens = new Set(uniqueTokens(memory.searchableText));
        let overlap = 0;

        for (const token of queryTokens) {
          if (memoryTokens.has(token)) overlap += 1;
        }

        return { memory, score: overlap };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || b.memory.updatedAt - a.memory.updatedAt)
      .slice(0, limit)
      .map(({ memory }) => mapMemoryRow(memory));
  }

  searchRelevantForGeneration(input: string, topic: PostTopic, limit = 3): Memory[] {
    const candidates = this.search(input, topic, 50);

    if (candidates.length === 0) {
      return [];
    }

    const queryTokens = uniqueTokens(input);
    return candidates
      .map((memory) => {
        const memoryTokens = new Set(uniqueTokens(memory.searchableText));
        let overlap = 0;

        for (const token of queryTokens) {
          if (memoryTokens.has(token)) overlap += 1;
        }

        const titleBonus =
          memory.title && normalizeText(input).includes(normalizeText(memory.title)) ? 2 : 0;
        const recencyBonus = Math.max(
          0,
          2 - Math.floor((Date.now() - memory.updatedAt) / (1000 * 60 * 60 * 24 * 30))
        );
        const approvalBonus =
          memory.status === "accepted" || memory.status === "published" ? 4 : 0;

        return {
          memory,
          score: overlap * 3 + titleBonus + recencyBonus + approvalBonus,
        };
      })
      .filter(({ score }, index) => score > 0 || (queryTokens.length === 0 && index < limit))
      .sort((a, b) => b.score - a.score || b.memory.updatedAt - a.memory.updatedAt)
      .slice(0, limit)
      .map(({ memory }) => memory);
  }

  save(input: SaveMemoryInput): void {
    const now = Date.now();
    const createdAt = input.createdAt ?? now;
    const searchableText = buildSearchableText({
      input: input.input,
      title: input.title ?? null,
      body: input.body,
      topic: input.topic,
      status: input.status,
    } as Pick<Post, "input" | "title" | "body" | "topic" | "status">);

    if (typeof input.sourcePostId === "number") {
      rawSqlite
        .prepare(`
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
            updated_at = excluded.updated_at
        `)
        .run(
          input.sourcePostId,
          input.input,
          input.title ?? null,
          input.body,
          input.topic,
          input.type,
          input.status,
          input.scheduledFor ?? 0,
          searchableText,
          createdAt,
          now
        );
      return;
    }

    rawSqlite
      .prepare(`
        INSERT INTO memories (
          source_post_id, input, title, body, topic, type, status, scheduled_for, searchable_text, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        -now,
        input.input,
        input.title ?? null,
        input.body,
        input.topic,
        input.type,
        input.status,
        input.scheduledFor ?? 0,
        searchableText,
        createdAt,
        now
      );
  }

  syncPosts(statuses: PostStatus[] = ["accepted", "published"]): number {
    const placeholders = statuses.map(() => "?").join(", ");
    const rows = rawSqlite
      .prepare(`
        SELECT
          id,
          input,
          title,
          body,
          topic,
          type,
          status,
          scheduled_for AS scheduledFor,
          created_at AS createdAt
        FROM posts
        WHERE status IN (${placeholders})
      `)
      .all(...statuses) as Array<{
        id: number;
        input: string;
        title: string | null;
        body: string | null;
        topic: PostTopic;
        type: "tweet" | "thread";
        status: PostStatus;
        scheduledFor: number;
        createdAt: number;
      }>;

    let synced = 0;
    for (const post of rows) {
      if (!post.body) continue;
      this.save({
        sourcePostId: post.id,
        input: post.input,
        title: post.title,
        body: post.body,
        topic: post.topic,
        type: post.type,
        status: post.status,
        scheduledFor: post.scheduledFor,
        createdAt: post.createdAt,
      });
      synced += 1;
    }

    return synced;
  }

  runSql(sql: string, params: unknown[] = []): RunSqlResult {
    const statement = rawSqlite.prepare(sql);
    if ((statement as { reader?: boolean }).reader) {
      return {
        kind: "rows",
        rows: statement.all(...params),
      };
    }

    const result = statement.run(...params);
    return {
      kind: "write",
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid,
    };
  }

  readDataDictionary(): DictionaryRow[] {
    return rawSqlite
      .prepare(`
        SELECT key, value, updated_at AS updatedAt
        FROM memory_data_dictionary
        ORDER BY key ASC
      `)
      .all() as DictionaryRow[];
  }

  writeDataDictionary(entries: Array<{ key: string; value: string }>, replace = false): number {
    const now = Date.now();

    if (replace) {
      rawSqlite.prepare("DELETE FROM memory_data_dictionary").run();
    }

    const upsert = rawSqlite.prepare(`
      INSERT INTO memory_data_dictionary (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `);

    let writes = 0;
    for (const entry of entries) {
      upsert.run(entry.key, entry.value, now);
      writes += 1;
    }

    return writes;
  }

  ensureDataDictionary(): number {
    return this.writeDataDictionary([
      {
        key: "memories.table",
        value:
          "Table memories stores one upserted memory snapshot per source post. Use source_post_id as the stable join key back to posts. Columns: id, source_post_id, input, title, body, topic, type, status, scheduled_for, searchable_text, created_at, updated_at.",
      },
      {
        key: "memory.agent.write",
        value:
          "Memory write agent runs on post generation, approval, and scheduling. It upserts the latest snapshot for a source post and keeps the data dictionary current.",
      },
      {
        key: "memory.agent.read",
        value:
          "Memory read agent is callable as a tool by content-generation agents. It should prefer accepted or published memories for writing-style inference and use generated memories only for continuity when useful.",
      },
      {
        key: "memories.statuses",
        value:
          "Memories.status mirrors the current post lifecycle snapshot. Rejected memories should generally be excluded from generation context.",
      },
    ]);
  }

  buildAgentPreamble(role: "read" | "write"): string {
    const dictionary = this.readDataDictionary();
    const header =
      role === "write"
        ? "Memory write agent bootstrap context:"
        : "Memory read agent bootstrap context:";

    return `${header}
Start every memory-agent run with this data dictionary before making schema or SQL decisions.

${formatDictionaryRows(dictionary)}
`;
  }

  formatForPrompt(memoriesToUse: Memory[]): string {
    if (memoriesToUse.length === 0) {
      return "";
    }

    const lines = memoriesToUse.map((memory, index) => {
      const date = new Date(memory.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const statusLabel =
        memory.status === "accepted" || memory.status === "published"
          ? "approved"
          : memory.status;

      return `${index + 1}. ${date} | ${statusLabel} | ${memory.title ?? memory.input}\n${buildMemoryPreview(memory)}`;
    });

    return `Relevant memories:
${lines.join("\n\n")}

Use these only if they genuinely help with continuity, progress, or specific style context.`;
  }
}

const memoryStore = new MemoryStore();
export async function readRecentGitHubActivityTool(days?: number) {
  return fetchRecentGitHubActivity(days);
}

async function runAgentLoop(
  systemPrompt: string,
  userPrompt: string,
  tools: any[],
  handlers: Record<string, (args: any) => unknown>,
  maxTurns = 6
): Promise<string> {
  const messages: any[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  for (let i = 0; i < maxTurns; i += 1) {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.2,
    });

    const message = response.choices[0]?.message;
    if (!message) {
      throw new Error("Memory agent returned no message");
    }

    messages.push(message);

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return message.content?.trim() || "No memory answer returned.";
    }

    for (const toolCall of message.tool_calls) {
      const args = toolCall.function.arguments
        ? JSON.parse(toolCall.function.arguments)
        : {};
      const handler = handlers[toolCall.function.name];
      const result = handler
        ? handler(args)
        : { error: `Unknown tool: ${toolCall.function.name}` };

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  throw new Error("Memory agent exceeded tool-call limit");
}

export async function askMemoryWriteAgent(args: {
  event: MemoryWriteEvent;
  post: Post;
}): Promise<string> {
  const { event, post } = args;
  const systemPrompt = `${memoryStore.buildAgentPreamble("write")}

You are the memory write agent for this app.
You are invoked on post generation, approval, and scheduling events.
Use the available tools to keep memory snapshots and the data dictionary aligned with current post state.
If the post has no body, explain that nothing was persisted.`;

  const userPrompt = `Handle this memory write event:
- event: ${event}
- source post id: ${post.id}
- status: ${post.status}
- topic: ${post.topic}
- type: ${post.type}
- scheduled_for: ${post.scheduledFor}
- title: ${post.title ?? ""}
- input: ${post.input}
- body:
${post.body ?? ""}

Persist the correct memory snapshot for this lifecycle event and keep the data dictionary current.`;

  return runAgentLoop(
    systemPrompt,
    userPrompt,
    [
      {
        type: "function",
        function: {
          name: "ensureDataDictionary",
          description: "Ensure the write-agent data dictionary entries are present and current.",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "upsertMemory",
          description: "Create or update the latest memory snapshot for a source post.",
          parameters: {
            type: "object",
            properties: {
              sourcePostId: { type: "number" },
              input: { type: "string" },
              title: { type: ["string", "null"] },
              body: { type: "string" },
              topic: { type: "string" },
              type: { type: "string" },
              status: { type: "string" },
              scheduledFor: { type: "number" },
              createdAt: { type: "number" },
            },
            required: ["sourcePostId", "input", "body", "topic", "type", "status"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "deleteMemoryBySourcePostId",
          description: "Delete a memory snapshot for a source post.",
          parameters: {
            type: "object",
            properties: {
              sourcePostId: { type: "number" },
            },
            required: ["sourcePostId"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "writeDataDictionary",
          description: "Write or replace memory data dictionary entries after schema or semantic changes.",
          parameters: {
            type: "object",
            properties: {
              entries: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    key: { type: "string" },
                    value: { type: "string" },
                  },
                  required: ["key", "value"],
                },
              },
              replace: { type: "boolean" },
            },
            required: ["entries"],
          },
        },
      },
    ],
    {
      ensureDataDictionary: () => ({ writes: memoryStore.ensureDataDictionary() }),
      upsertMemory: (toolArgs) => {
        memoryStore.save({
          sourcePostId: toolArgs.sourcePostId,
          input: toolArgs.input,
          title: toolArgs.title,
          body: toolArgs.body,
          topic: toolArgs.topic,
          type: toolArgs.type,
          status: toolArgs.status,
          scheduledFor: toolArgs.scheduledFor,
          createdAt: toolArgs.createdAt,
        });
        return { ok: true };
      },
      deleteMemoryBySourcePostId: (toolArgs) => {
        memoryStore.deleteBySourcePostId(toolArgs.sourcePostId);
        return { ok: true };
      },
      writeDataDictionary: (toolArgs) => ({
        writes: memoryStore.writeDataDictionary(toolArgs.entries ?? [], toolArgs.replace),
      }),
    }
  );
}

export async function askMemoryReadAgent(question: string): Promise<string> {
  const systemPrompt = `${memoryStore.buildAgentPreamble("read")}

You are the memory read agent for this app.
You answer natural-language questions from content-generation agents.
Prefer approved memories for style inference, but you may use generated memories for continuity if they are clearly relevant.
If recent GitHub repositories, pull requests, or commits would materially improve the answer, fetch and summarize them.
Keep answers compact and directly useful to a writing agent.`;

  return runAgentLoop(
    systemPrompt,
    question,
    [
      {
        type: "function",
        function: {
          name: "readDataDictionary",
          description: "Read the current memory data dictionary entries.",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "listMemories",
          description: "List the most recent memories.",
          parameters: {
            type: "object",
            properties: {
              limit: { type: "number" },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "getMemoryById",
          description: "Fetch a memory by id.",
          parameters: {
            type: "object",
            properties: {
              id: { type: "number" },
            },
            required: ["id"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "searchMemories",
          description: "Keyword search memories, optionally filtered by topic.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string" },
              topic: { type: "string" },
              limit: { type: "number" },
            },
            required: ["query"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "readRecentGitHubActivity",
          description:
            "Fetch recent GitHub repositories, pull requests, and commits for the configured account.",
          parameters: {
            type: "object",
            properties: {
              days: { type: "number" },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "findRelevantMemories",
          description:
            "Find the most relevant memories for a new content-generation request and format them for prompt use.",
          parameters: {
            type: "object",
            properties: {
              input: { type: "string" },
              topic: { type: "string" },
              limit: { type: "number" },
            },
            required: ["input", "topic"],
          },
        },
      },
    ],
    {
      readDataDictionary: () => memoryStore.readDataDictionary(),
      listMemories: (toolArgs) => memoryStore.list(toolArgs.limit),
      getMemoryById: (toolArgs) => memoryStore.getById(toolArgs.id),
      searchMemories: (toolArgs) =>
        memoryStore.search(toolArgs.query, toolArgs.topic, toolArgs.limit),
      readRecentGitHubActivity: async (toolArgs) => {
        const activity = await readRecentGitHubActivityTool(toolArgs.days);
        return {
          ...activity,
          promptContext: formatGitHubActivityForPrompt(activity),
        };
      },
      findRelevantMemories: (toolArgs) =>
        memoryStore.formatForPrompt(
          memoryStore.searchRelevantForGeneration(toolArgs.input, toolArgs.topic, toolArgs.limit)
        ),
    }
  );
}

export async function syncApprovedPostsToMemoryStore(): Promise<number> {
  memoryStore.ensureDataDictionary();
  return memoryStore.syncPosts();
}

export async function listMemories(limit?: number): Promise<Memory[]> {
  return memoryStore.list(limit);
}

export async function deleteMemory(id: number): Promise<void> {
  memoryStore.delete(id);
}

export async function deleteMemoryBySourcePostId(sourcePostId: number): Promise<void> {
  memoryStore.deleteBySourcePostId(sourcePostId);
}

export async function searchMemories(
  query: string,
  topic?: PostTopic,
  limit?: number
): Promise<Memory[]> {
  return memoryStore.search(query, topic, limit);
}

export async function findRelevantMemories(
  input: string,
  topic: PostTopic,
  limit = 3
): Promise<Memory[]> {
  return memoryStore.searchRelevantForGeneration(input, topic, limit);
}

export function formatMemoriesForPrompt(memoriesToUse: Memory[]): string {
  return memoryStore.formatForPrompt(memoriesToUse);
}

export function runMemorySqlTool(sql: string, params?: unknown[]) {
  return memoryStore.runSql(sql, params);
}

export function readMemoryDataDictionaryTool() {
  return memoryStore.readDataDictionary();
}

export function writeMemoryDataDictionaryTool(
  entries: Array<{ key: string; value: string }>,
  replace?: boolean
) {
  return memoryStore.writeDataDictionary(entries, replace);
}

export function getMemoryAgentPreamble() {
  return memoryStore.buildAgentPreamble("read");
}
