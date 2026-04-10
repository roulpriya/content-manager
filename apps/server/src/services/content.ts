import { MODEL, openai } from "../lib/llm.js";
import type { PostTopic } from "../db/schema.js";
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

const TOPIC_PROMPTS: Record<PostTopic, string> = {
  "day-schedule": `This is my day schedule. Convert this into a clean, engaging Twitter post.

- Use bullet points or short structured lines
- Keep language simple and human (not technical)
- Fix grammar and remove any AI-like phrasing
- Highlight flow of the day (morning -> night)
- Add 1 subtle reflective line at the end

Tone: calm, minimal, slightly reflective
Avoid: hashtags overload, emojis, robotic tone`,

  "gym-routine": `This is my gym routine/workout log. Convert this into an engaging Twitter post.

- Start with a strong hook (progress, discipline, or struggle)
- List workouts in a clean, readable format
- Highlight intensity, weights, or improvement if present
- Add a short takeaway (consistency, strength, mindset)

Tone: energetic, disciplined, slightly motivational
Avoid: sounding like a fitness influencer cliche
Optional: 1-2 subtle emojis max`,

  "llm-project": `This is about a project I built using LLMs. Convert this into a Twitter post.

- Start with what I built in one crisp line
- Explain what problem it solves
- Mention key technical aspects (without overloading)
- Add 1 interesting insight or challenge faced
- End with a subtle flex or learning

Tone: builder-focused, sharp, slightly technical
Audience: developers + indie hackers
Avoid: buzzwords, generic AI hype`,

  "new-tech-stack": `This is about a new tech stack/tool I learned. Convert this into a Twitter post.

- Start with what I explored
- Break down what it does in simple terms
- Mention why it's interesting/useful
- Add my personal learning or first impression

Tone: curious, exploratory, honest
Avoid: deep jargon, long explanations
Make it feel like sharing, not teaching`,

  "ui-product-demo": `This is about a UI/product/demo I built. Convert this into a Twitter post.

- Start with a hook describing what it is
- Explain what it does in 1-2 lines
- Highlight key features or interactions
- Keep it concise and visual-friendly
- End with a call to action (feedback, thoughts, etc.)

Tone: product-focused, crisp, confident
Assume this will be posted with an image/video
Avoid: over-explaining internals`,

  general: `Convert this into a clean, engaging Twitter post.

- Make it feel like a real human wrote it
- Prioritize clarity, personality, and natural flow
- Avoid generic phrases like "excited to share"
- Keep the writing specific and grounded`,
};

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
${TOPIC_PROMPTS[topic]}

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
${TOPIC_PROMPTS[topic]}

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
