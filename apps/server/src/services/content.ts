import { MODEL, openai } from "../lib/llm.js";
import type { PostTopic } from "../db/schema.js"; // string
import { askMemoryReadAgent } from "./memory.js";

const SYSTEM_PROMPT = `You turn rough notes into sharp Twitter posts and threads.

Your writing should feel:
- Human, natural, and specific
- Engaging and conversational
- Clear and structured
- Confident without sounding robotic
- True to the requested topic and tone

You should aggressively remove AI-sounding phrasing, filler, generic fluff, and hype.
Do not use double dashes.
Do not sound like a template.
Keep things readable, social-media native, and close to the user's existing writing style when memory context is available.

Always respond with valid JSON in the exact shape requested.`;

const MEMORY_READ_TOOL = {
  type: "function",
  function: {
    name: "memoryRead",
    description:
      "Ask the memory read agent for prior style/context signals from stored post memories and relevant recent GitHub activity before writing.",
    parameters: {
      type: "object",
      properties: {
        question: { type: "string" },
      },
      required: ["question"],
    },
  },
} as const;

const TOPIC_PROMPTS: Record<string, string> = {
  "new-tech-stack": `This is about a new technology, tool, or framework I explored. Turn it into a Twitter post.

- Lead with what the tool is and what gap it fills
- One concrete thing it does better than the alternative
- My honest first impression — what worked, what didn't
- Why it's worth paying attention to (or why it isn't)

Voice: technically literate, honest, not a sales pitch
Avoid: "game-changer", generic hype, surface-level takes
Make it feel like a signal, not noise`,

  "ui-product-demo": `This is about a UI, product, or demo I built. Turn it into a Twitter post.

- Hook: what it is and what it does — one line
- Key interaction or feature that makes it interesting
- Technical detail that was non-obvious to build
- Optional: what to try or look at (assumes image/video attached)

Voice: confident, product-focused, technical but accessible
Avoid: over-explaining, listing features like a changelog
Write for someone who builds things`,

  "github-daily": `Turn this GitHub activity into a sharp, high-signal Twitter post.

Structure:
- First line: "Working on [project name]" or "Progress update: [project name]" (infer project name from context)
- Follow with 2–4 bullet points capturing the most meaningful technical changes
- Each bullet must start with a strong action verb: Improved, Added, Optimized, Fixed, Refactored, Simplified, Shipped
- Focus on impact, not just activity (what got better, faster, cleaner, or more scalable)

Voice:
- Confident senior engineer
- Crisp, direct, no filler
- Sounds like a builder shipping real systems, not documenting tasks

Style:
- Use precise technical language where it adds clarity
- Prefer specifics over vague statements (e.g., "reduced latency in X" > "improved performance")
- Keep it tight and readable — every line should carry weight

Avoid:
- Emojis, hashtags, hype
- Generic phrases like "made improvements"
- Over-explaining or storytelling

Goal:
- Feels like a high-quality dev update someone would pause and read
- Signals competence and progress in a few lines`,
};

function getTopicPrompt(topic: string): string {
  if (TOPIC_PROMPTS[topic]) return TOPIC_PROMPTS[topic];
  return `Convert this into a sharp, clear Twitter post about ${topic}.

- Be specific — ground every claim in something concrete
- Write like someone who actually knows this space well
- No filler, no setup, no generic openers
- Every sentence should carry weight

Voice: confident, direct, human`;
}

const UNIVERSAL_ADD_ON = `Universal requirements:
- Keep it under 280 characters if possible for a single tweet
- Make it feel like a real human wrote it
- Avoid generic phrases like "excited to share"
- Prioritize clarity and personality
- Avoid filler words and empty setup
- Do not use double dashes
- Prefer crisp, natural sentences over polished AI-sounding phrasing
- If memory context includes writing-style patterns, follow them closely`;

const TWEET_PROMPT = (input: string, topic: PostTopic) => `
Input:
${input}

Topic instructions:
${getTopicPrompt(topic)}

Format instructions:
- Write one tweet only
- Max 280 characters
- No hashtag overload
- Use line breaks only if they improve readability

${UNIVERSAL_ADD_ON}

Respond with JSON: { "title": "short label", "body": "the tweet text" }
`;

const THREAD_PROMPT = (input: string, topic: PostTopic) => `
Input:
${input}

Topic instructions:
${getTopicPrompt(topic)}

Format instructions:
- Write a Twitter thread
- First tweet should have the strongest hook
- 5-8 tweets total
- Each tweet should stay under 280 characters
- Number each tweet as "1/", "2/", etc.
- Keep a logical flow from tweet to tweet
- End with a strong closing line, takeaway, or soft call to action

${UNIVERSAL_ADD_ON}

Respond with JSON: { "title": "short label", "body": "full thread with each tweet on a new line" }
`;

export async function generateContent(
  input: string,
  type: "tweet" | "thread",
  topic: PostTopic,
  feedback?: string
): Promise<{ title: string; body: string }> {
  const basePrompt =
    type === "tweet" ? TWEET_PROMPT(input, topic) : THREAD_PROMPT(input, topic);
  const promptSections = [basePrompt];

  if (feedback) {
    promptSections.push(
      `User feedback on the previous version: "${feedback}"\nApply this feedback in the new version.`
    );
  }

  const prompt = promptSections.join("\n\n");

  const messages: any[] = [
    {
      role: "system",
      content: `${SYSTEM_PROMPT}

You may call the memoryRead tool when prior approved or scheduled post context would improve style matching or continuity.
Use it for recent GitHub repositories, pull requests, and commits when the draft is about work, building, shipping, coding, projects, or daily progress.
Do not call it unless it will materially help this draft.`,
    },
    { role: "user", content: prompt },
  ];

  for (let i = 0; i < 4; i += 1) {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages,
      tools: [MEMORY_READ_TOOL as any],
      tool_choice: "auto",
      response_format: { type: "json_object" },
      temperature: 0.8,
    });

    const message = response.choices[0]?.message;
    if (!message) {
      throw new Error("No content returned from LLM");
    }

    messages.push(message);

    if (!message.tool_calls || message.tool_calls.length === 0) {
      const content = message.content;
      if (!content) throw new Error("No content returned from LLM");
      return JSON.parse(content) as { title: string; body: string };
    }

    for (const toolCall of message.tool_calls) {
      const args = toolCall.function.arguments
        ? JSON.parse(toolCall.function.arguments)
        : {};
      const memoryAnswer = await askMemoryReadAgent(args.question ?? "");

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: memoryAnswer,
      });
    }
  }

  throw new Error("Content generation exceeded tool-call limit");
}

export async function generateCalendarContent(
  input: string,
  type: "tweet" | "thread",
  topic: PostTopic,
  dayNumber: number,
  totalDays: number,
  scheduledFor: number
): Promise<{ title: string; body: string }> {
  const calendarContext = `Calendar planning context:
- This is post ${dayNumber} of ${totalDays}
- Planned publish date: ${new Date(scheduledFor).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}
- Keep the same broad theme, but make this entry distinct from the other days
- Avoid repeating the same hook, phrasing, or structure as nearby posts`;

  return generateContent(input, type, topic, calendarContext);
}
