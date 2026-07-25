import { openai, MODEL } from "../lib/llm.js";

export type EnrichedContent = {
  summary: string;
  keyFacts: string[];
  links: { title: string; url: string; snippet: string }[];
};

export type LinkedSourceResearch = {
  urls: string[];
  summary: string;
  keyPoints: string[];
  notableQuotes: string[];
};

const URL_PATTERN = /https?:\/\/[^\s<>()\[\]{}"']+/gi;

export function extractUrls(input: string): string[] {
  return [...new Set((input.match(URL_PATTERN) ?? []).map((url) => url.replace(/[.,!?;:]+$/, "")))];
}

export async function researchLinkedSources(input: string): Promise<LinkedSourceResearch | null> {
  const urls = extractUrls(input);
  if (urls.length === 0) return null;

  const researchResponse = await openai.responses.create({
    model: MODEL,
    input: `Read the linked source(s) below before doing anything else.

${urls.map((url, index) => `${index + 1}. ${url}`).join("\n")}

Extract the article's actual subject, central argument, and 3-6 concrete ideas that would be worth sharing in a Twitter post. Preserve a short quotation only when you can verify the exact wording from the source. Do not infer article content from the user's surrounding prompt and do not substitute a different article. If a source cannot be accessed, say so explicitly.`,
    tools: [{ type: "web_search_preview" }],
  });

  const structureResponse = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `Turn source research into grounded writing notes.
Respond only as JSON with this shape:
{ "summary": "...", "keyPoints": ["..."], "notableQuotes": ["..."] }

Rules:
- Include only claims supported by the research text.
- Never manufacture or complete a quotation.
- Keep key points concrete and faithful to the source.
- If the source was inaccessible, explain that in summary and return empty arrays.`,
      },
      { role: "user", content: researchResponse.output_text },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const structured = JSON.parse(
    structureResponse.choices[0]?.message?.content ?? "{}"
  ) as { summary?: string; keyPoints?: string[]; notableQuotes?: string[] };

  return {
    urls,
    summary: structured.summary ?? "The linked source could not be summarized.",
    keyPoints: structured.keyPoints ?? [],
    notableQuotes: structured.notableQuotes ?? [],
  };
}

export async function enrichIdea(topic: string): Promise<EnrichedContent> {
  // Step 1: Web search via Responses API
  const searchResponse = await openai.responses.create({
    model: MODEL,
    input: `Research this idea from a software developer's perspective: "${topic}".
Provide a comprehensive overview including key concepts, recent developments, interesting facts, and useful resources.`,
    tools: [{ type: "web_search_preview" }],
  });

  const outputText = searchResponse.output_text;

  // Extract url_citation annotations
  const links: { title: string; url: string; snippet: string }[] = [];
  for (const item of searchResponse.output) {
    if (item.type === "message") {
      for (const content of item.content) {
        if (content.type === "output_text") {
          for (const annotation of content.annotations) {
            if (annotation.type === "url_citation") {
              links.push({
                title: annotation.title,
                url: annotation.url,
                snippet: outputText.slice(annotation.start_index, annotation.end_index),
              });
            }
          }
        }
      }
    }
  }

  // Step 2: Structure into summary + key facts JSON
  const structureResponse = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a research assistant. Extract from the provided research text: a concise 2–3 sentence summary and 3–5 key facts. Respond with JSON only: { \"summary\": \"...\", \"keyFacts\": [\"...\"] }",
      },
      { role: "user", content: outputText },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const structured = JSON.parse(
    structureResponse.choices[0]?.message?.content ?? "{}"
  ) as { summary?: string; keyFacts?: string[] };

  return {
    summary: structured.summary ?? outputText.slice(0, 500),
    keyFacts: structured.keyFacts ?? [],
    links: links.slice(0, 8),
  };
}
