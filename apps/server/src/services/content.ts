import { MODEL, openai } from "../lib/llm.js";

const SYSTEM_PROMPT = `You are a senior developer with strong opinions about software engineering.
You write technical Twitter content that is direct, insightful, and never generic.

Your voice:
- Confident and opinionated, not wishy-washy
- Grounded in real-world experience
- Avoids buzzwords and hype
- Punchy and clear

When given a raw idea, you:
1. Extract the core insight
2. Write content in the requested format

Always respond with valid JSON in the exact shape requested.`;

const TWEET_PROMPT = (input: string) => `
Generate a tweet from this idea: "${input}"

Rules:
- Max 280 characters
- No hashtags
- Strong, opinionated take
- Reads like a senior dev sharing hard-won wisdom

Respond with JSON: { "title": "short label", "body": "the tweet text" }
`;

const THREAD_PROMPT = (input: string) => `
Generate a Twitter thread from this idea: "${input}"

Rules:
- First tweet: strong hook that makes people want to read on
- 5-8 tweets total
- Each tweet max 280 characters, no hashtags
- Logical flow, each tweet stands alone but builds on the last
- Last tweet: strong conclusion or call to action
- Number each tweet: "1/", "2/", etc.

Respond with JSON: { "title": "short label", "body": "full thread with each tweet on a new line" }
`;

export async function generateContent(
  input: string,
  type: "tweet" | "thread",
  feedback?: string
): Promise<{ title: string; body: string }> {
  const basePrompt = type === "tweet" ? TWEET_PROMPT(input) : THREAD_PROMPT(input);
  const prompt = feedback
    ? `${basePrompt}\nUser feedback on the previous version: "${feedback}"\nApply this feedback in the new version.`
    : basePrompt;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.8,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No content returned from LLM");

  const parsed = JSON.parse(content) as { title: string; body: string };
  return parsed;
}
