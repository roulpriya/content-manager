import { MODEL, openai } from "../lib/llm.js";
import { rawSqlite } from "../db/index.js";
import type { Memory, Post, PostTopic } from "../db/schema.js";

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

function buildSearchableText(post: Pick<Post, "input" | "title" | "body" | "topic">): string {
  return [post.topic, post.title ?? "", post.input, post.body].join(" ").trim();
}

type MemoryRow = {
  id: number;
  sourcePostId: number;
  input: string;
  title: string | null;
  body: string;
  topic: PostTopic;
  type: "tweet" | "thread";
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
  createdAt?: number;
};

type RunSqlResult =
  | { kind: "rows"; rows: unknown[] }
  | { kind: "write"; changes: number; lastInsertRowid: number | bigint };

function mapMemoryRow(row: MemoryRow): Memory {
  return row;
}

function buildMemoryPreview(memory: Memory) {
  const condensed = memory.body.replace(/\s+/g, " ").trim();
  return condensed.length > 220 ? `${condensed.slice(0, 217)}...` : condensed;
}

class MemoryAgent {
  async saveApprovedPost(post: Post): Promise<void> {
    if (!post.body) return;
    await this.save({
      sourcePostId: post.id,
      input: post.input,
      title: post.title,
      body: post.body,
      topic: post.topic,
      type: post.type,
      createdAt: post.createdAt,
    });
  }

  async syncApprovedPosts(): Promise<number> {
    const approvedPosts = rawSqlite
      .prepare(`
        SELECT
          id,
          input,
          title,
          body,
          topic,
          type,
          scheduled_for AS scheduledFor,
          created_at AS createdAt,
          updated_at AS updatedAt,
          status
        FROM posts
        WHERE status IN ('accepted', 'published')
      `)
      .all() as Array<{
        id: number;
        input: string;
        title: string | null;
        body: string | null;
        topic: PostTopic;
        type: "tweet" | "thread";
        scheduledFor: number;
        createdAt: number;
        updatedAt: number;
        status: Post["status"];
      }>;

    let synced = 0;
    for (const post of approvedPosts) {
      if (!post.body) continue;
      await this.saveApprovedPost(post);
      synced += 1;
    }

    return synced;
  }

  async list(limit = 50): Promise<Memory[]> {
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

  async delete(id: number): Promise<void> {
    rawSqlite.prepare("DELETE FROM memories WHERE id = ?").run(id);
  }

  async search(query: string, topic?: PostTopic, limit = 10): Promise<Memory[]> {
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
              searchable_text AS searchableText,
              created_at AS createdAt,
              updated_at AS updatedAt
            FROM memories
            WHERE topic = ?
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
              searchable_text AS searchableText,
              created_at AS createdAt,
              updated_at AS updatedAt
            FROM memories
            ORDER BY updated_at DESC
          `)
          .all() as MemoryRow[]);

    const queryTokens = uniqueTokens(query);

    if (queryTokens.length === 0) {
      return base.slice(0, limit);
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
      .map(({ memory }) => memory);
  }

  async searchRelevantForGeneration(
    input: string,
    topic: PostTopic,
    limit = 3
  ): Promise<Memory[]> {
    const candidates = await this.search(input, topic, 50);

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

        return {
          memory,
          score: overlap * 3 + titleBonus + recencyBonus,
        };
      })
      .filter(({ score }, index) => score > 0 || (queryTokens.length === 0 && index < limit))
      .sort((a, b) => b.score - a.score || b.memory.updatedAt - a.memory.updatedAt)
      .slice(0, limit)
      .map(({ memory }) => memory);
  }

  async save(input: SaveMemoryInput): Promise<void> {
    const now = Date.now();
    const createdAt = input.createdAt ?? now;
    const searchableText = buildSearchableText({
      input: input.input,
      title: input.title ?? null,
      body: input.body,
      topic: input.topic,
    });

    if (typeof input.sourcePostId === "number") {
      rawSqlite
        .prepare(`
          INSERT INTO memories (
            source_post_id, input, title, body, topic, type, searchable_text, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(source_post_id) DO UPDATE SET
            input = excluded.input,
            title = excluded.title,
            body = excluded.body,
            topic = excluded.topic,
            type = excluded.type,
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
          searchableText,
          createdAt,
          now
        );
      return;
    }

    rawSqlite
      .prepare(`
        INSERT INTO memories (
          source_post_id, input, title, body, topic, type, searchable_text, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        -now,
        input.input,
        input.title ?? null,
        input.body,
        input.topic,
        input.type,
        searchableText,
        createdAt,
        now
      );
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

  buildAgentPreamble(): string {
    const dictionary = this.readDataDictionary();

    if (dictionary.length === 0) {
      return "Memory agent data dictionary is currently empty.";
    }

    const formatted = dictionary
      .map((entry) => `- ${entry.key}: ${entry.value}`)
      .join("\n");

    return `Memory agent bootstrap context:
Start every memory-agent run with this data dictionary before making schema or SQL decisions.

${formatted}

If your SQL changes the schema or semantics of memory storage, update the data dictionary immediately after.`;
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

      return `${index + 1}. ${date} | ${memory.title ?? memory.input}\n${buildMemoryPreview(memory)}`;
    });

    return `Relevant past memories from approved posts:
${lines.join("\n\n")}

Use these only if they genuinely help with continuity, progress, or specific context. Do not force them in.`;
  }
}

export const memoryAgent = new MemoryAgent();

export async function saveApprovedPostToMemory(post: Post): Promise<void> {
  await memoryAgent.saveApprovedPost(post);
}

export async function syncApprovedPostsToMemoryStore(): Promise<number> {
  return memoryAgent.syncApprovedPosts();
}

export async function listMemories(limit?: number): Promise<Memory[]> {
  return memoryAgent.list(limit);
}

export async function deleteMemory(id: number): Promise<void> {
  await memoryAgent.delete(id);
}

export async function deleteMemoryBySourcePostId(sourcePostId: number): Promise<void> {
  rawSqlite.prepare("DELETE FROM memories WHERE source_post_id = ?").run(sourcePostId);
}

export async function searchMemories(
  query: string,
  topic?: PostTopic,
  limit?: number
): Promise<Memory[]> {
  return memoryAgent.search(query, topic, limit);
}

export async function findRelevantMemories(
  input: string,
  topic: PostTopic,
  limit = 3
): Promise<Memory[]> {
  return memoryAgent.searchRelevantForGeneration(input, topic, limit);
}

export function formatMemoriesForPrompt(memoriesToUse: Memory[]): string {
  return memoryAgent.formatForPrompt(memoriesToUse);
}

export function runMemorySqlTool(sql: string, params?: unknown[]) {
  return memoryAgent.runSql(sql, params);
}

export function readMemoryDataDictionaryTool() {
  return memoryAgent.readDataDictionary();
}

export function writeMemoryDataDictionaryTool(
  entries: Array<{ key: string; value: string }>,
  replace?: boolean
) {
  return memoryAgent.writeDataDictionary(entries, replace);
}

export function getMemoryAgentPreamble() {
  return memoryAgent.buildAgentPreamble();
}

export async function askMemoryAgent(question: string): Promise<string> {
  const systemPrompt = `${getMemoryAgentPreamble()}

You are the memory agent for this app.
Answer natural-language questions by using the available tools when needed.
Prefer reading the dictionary first if the question depends on schema or table meaning.
If the SQL changes memory schema or semantics, call writeDataDictionary after the SQL change.
Keep final answers concise and directly useful to the calling agent.`;

  const tools = [
    {
      type: "function",
      function: {
        name: "runSql",
        description: "Run a SQL query directly against the memory SQLite database.",
        parameters: {
          type: "object",
          properties: {
            sql: { type: "string" },
            params: {
              type: "array",
              items: {},
            },
          },
          required: ["sql"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "readDataDictionary",
        description: "Read the current memory data dictionary entries.",
        parameters: {
          type: "object",
          properties: {},
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
  ] as any;

  const messages: any[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: question },
  ];

  for (let i = 0; i < 6; i += 1) {
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

      let result: unknown;
      if (toolCall.function.name === "runSql") {
        result = runMemorySqlTool(args.sql, args.params);
      } else if (toolCall.function.name === "readDataDictionary") {
        result = readMemoryDataDictionaryTool();
      } else if (toolCall.function.name === "writeDataDictionary") {
        result = writeMemoryDataDictionaryTool(args.entries ?? [], args.replace);
      } else {
        result = { error: `Unknown tool: ${toolCall.function.name}` };
      }

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  throw new Error("Memory agent exceeded tool-call limit");
}
