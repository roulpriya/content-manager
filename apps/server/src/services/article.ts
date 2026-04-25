import { desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { articles, type Article } from "../db/schema.js";
import { openai, MODEL } from "../lib/llm.js";

const ARTICLE_SYSTEM_PROMPT = `You are an expert writer for Medium — a platform known for thoughtful, well-researched, and engaging long-form content.

Write in a style that is:
- Clear, direct, and easy to follow
- Intellectually honest — acknowledge nuance and tradeoffs
- Grounded in facts, examples, and real-world context
- Human and conversational, not corporate or academic
- Structured with clear headings and logical flow

Format requirements:
- Use Markdown (# for H1, ## for H2, ### for H3)
- Start with a compelling introduction (no heading for intro)
- 4–6 main sections with ## headings
- Include a conclusion section
- Use short paragraphs (2–4 sentences max)
- Use bullet lists sparingly — prefer prose
- Aim for 1500–2200 words
- Do not include a word count line

Do not use phrases like "in conclusion", "it is worth noting", "it is important to".
Avoid generic filler. Every sentence should earn its place.`;

export async function createArticle(topic: string): Promise<Article> {
  const ts = Date.now();
  const [article] = await db
    .insert(articles)
    .values({ topic, status: "researching", createdAt: ts, updatedAt: ts })
    .returning();
  return article!;
}

export async function listArticles(): Promise<Article[]> {
  return db.select().from(articles).orderBy(desc(articles.createdAt));
}

export async function getArticle(id: number): Promise<Article | undefined> {
  const [article] = await db.select().from(articles).where(eq(articles.id, id));
  return article;
}

export async function deleteArticle(id: number): Promise<void> {
  await db.delete(articles).where(eq(articles.id, id));
}

export async function startArticleGeneration(id: number): Promise<void> {
  const [article] = await db.select().from(articles).where(eq(articles.id, id));
  if (!article) throw new Error(`Article ${id} not found`);

  // Fire and forget
  (async () => {
    try {
      // Step 1: Deep web research
      const searchResponse = await openai.responses.create({
        model: MODEL,
        input: `Do deep research on the following topic for a comprehensive Medium article: "${article.topic}".

Gather:
- Core concepts and background
- Recent developments, trends, and data
- Different perspectives or schools of thought
- Real-world examples, case studies, or applications
- Common misconceptions or counterintuitive insights
- Practical takeaways for practitioners or curious readers

Be thorough. This research will be used to write a 1500–2200 word Medium-quality article.`,
        tools: [{ type: "web_search_preview" }],
      });

      const researchText = searchResponse.output_text;

      await db
        .update(articles)
        .set({ status: "writing", researchSummary: researchText.slice(0, 4000), updatedAt: Date.now() })
        .where(eq(articles.id, id));

      // Step 2: Generate the full article
      const articleResponse = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: ARTICLE_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Write a full Medium-quality article on the topic: "${article.topic}"

Use this research as your source material:
---
${researchText}
---

Respond with JSON: { "title": "...", "body": "full markdown article" }`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const raw = articleResponse.choices[0]?.message?.content;
      if (!raw) throw new Error("No content returned from LLM");

      const parsed = JSON.parse(raw) as { title?: string; body?: string };
      const title = parsed.title ?? article.topic;
      const body = parsed.body ?? "";
      const wordCount = body.split(/\s+/).filter(Boolean).length;

      await db
        .update(articles)
        .set({ status: "done", title, body, wordCount, updatedAt: Date.now() })
        .where(eq(articles.id, id));
    } catch (err) {
      await db
        .update(articles)
        .set({
          status: "error",
          errorMessage: err instanceof Error ? err.message : String(err),
          updatedAt: Date.now(),
        })
        .where(eq(articles.id, id));
    }
  })();
}
