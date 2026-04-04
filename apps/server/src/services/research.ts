import { openai, MODEL } from "../lib/llm.js";

export type EnrichedContent = {
  summary: string;
  keyFacts: string[];
  links: { title: string; url: string; snippet: string }[];
};

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
