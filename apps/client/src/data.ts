import type { Post, Idea, Memory, Article } from './types';

export const TOPICS = [
  'general',
  'day-schedule',
  'gym-routine',
  'llm-project',
  'new-tech-stack',
  'ui-product-demo',
] as const;

export const TOPIC_LABELS: Record<string, string> = {
  'day-schedule':   'Day Schedule',
  'gym-routine':    'Gym Routine',
  'llm-project':    'LLM Project',
  'new-tech-stack': 'New Tech Stack',
  'ui-product-demo':'UI Demo',
  'general':        'General',
};

export const TOPIC_ICONS: Record<string, string> = {
  'day-schedule':   '◑',
  'gym-routine':    '◆',
  'llm-project':    '◎',
  'new-tech-stack': '◈',
  'ui-product-demo':'▣',
  'general':        '○',
};

export const SAMPLES: Record<string, { tweet: string; thread: string[] }> = {
  'llm-project': {
    tweet: `Been heads down building a memory layer for my writing assistant.\n\nToken-based FTS with recency weighting — turns out your own old writing is the best style guide you'll ever find.\n\nShipping this week.`,
    thread: [
      `1/ 3 months building Quill. Here's what surprised me about teaching an LLM to match your voice:`,
      `2/ First instinct: fine-tune. Wrong. Fine-tuning kills reasoning. RAG beats it every time for style adaptation.`,
      `3/ The trick: every accepted post feeds a SQLite memory table. Token-scored FTS with recency + topic bonuses.`,
      `4/ At generation time, the 5 most relevant past posts get injected as style context. The model reads your work and mirrors it.`,
      `5/ After ~30 accepted posts, I stopped editing output almost entirely. The voice is genuinely mine now. Wild.`,
    ],
  },
  'gym-routine': {
    tweet: `Workout done before the city woke up.\n\n5:45am squat rack. No one else. Just the bar and the math of getting stronger.\n\nConsistency over intensity. Every single time.`,
    thread: [
      `1/ 6 months of training the same way. Here's what actually worked:`,
      `2/ Cut the variety. Same 4 movements every week. Squat. Hinge. Push. Pull. Progress on those before anything else.`,
      `3/ Track everything. Not for analytics — for honesty. You can't fool a spreadsheet.`,
      `4/ Sleep is training. 7 hours minimum. Every cut shows up in the gym 2 days later.`,
      `5/ The boring stuff works. You already know this. The hard part is doing it anyway.`,
    ],
  },
  'day-schedule': {
    tweet: `Today was for deep work.\n\nMorning: architecture decisions, no meetings.\nAfternoon: one problem, fully solved.\nEvening: closed every tab.\n\nThis is what good days feel like.`,
    thread: [
      `1/ How I structured today to reach flow state:`,
      `2/ No calendar until noon. Mornings are non-negotiable. Hard problems first.`,
      `3/ One context per session. I physically close everything unrelated. Friction is the point.`,
      `4/ Two 90-min blocks. A short walk between them. The walk is where things click.`,
      `5/ Evening review: what actually moved? One thing. Usually enough.`,
    ],
  },
  'new-tech-stack': {
    tweet: `Switched my backend from Express to tRPC last week.\n\nEnd-to-end type safety is genuinely different. Not "nice to have" — it changes how you think about the API contract.\n\nShould have done this a year ago.`,
    thread: [
      `1/ Migrated to tRPC + Drizzle this weekend. Here's what I learned:`,
      `2/ tRPC: the mental shift is that your API is a TypeScript interface, not a REST contract. Your client just calls functions.`,
      `3/ Drizzle: SQL-first is underrated. You write real queries. The ORM gets out of your way.`,
      `4/ SQLite in production is underused. For solo projects? It's fast, zero-infra, backed by a file.`,
      `5/ The stack is now so thin I can hold it all in my head. That matters more than I expected.`,
    ],
  },
  'ui-product-demo': {
    tweet: `Shipped the post generation flow today.\n\nRough notes → topic select → streaming output → accept/reject → style memory.\n\nThe whole loop in under 10 seconds. Clean.`,
    thread: [
      `1/ Just shipped v0.1 of Quill. Here's the full flow:`,
      `2/ Input: raw notes, bullet points, half-formed thoughts. Whatever you have.`,
      `3/ Topic presets handle tone: gym, build log, product demo, schedule — each tuned differently.`,
      `4/ Output streams in. You watch your words become a post. Then you decide: keep it or not.`,
      `5/ Accepted posts feed the memory. Next time, the model already knows how you write.`,
    ],
  },
  'general': {
    tweet: `The best writing habit isn't about writing more.\n\nIt's about lowering friction between having something to say and actually saying it.\n\nThat's the only thing that's ever worked for me.`,
    thread: [
      `1/ After a year of consistent posting, here's the one thing that changed everything:`,
      `2/ Notes. Not outlines. Not drafts. Just a running log of observations, fragments, reactions.`,
      `3/ The posts write themselves from the notes. Your job is just to notice things and write them down.`,
      `4/ Consistency isn't willpower. It's a system that removes the decision of whether to show up.`,
      `5/ Ship the small thing. The perfect post is the enemy of the published one.`,
    ],
  },
};

export const ARTICLE_BODY = `## The Quiet Friction

Every creator knows the feeling. You have something to say — a sharp observation, a process you've refined, a lesson from a hard week. The idea is clear. But between "I have this" and "this is published" there's a gap that swallows more content than it ever ships.

That gap is friction. The cognitive overhead of translating a raw thought into polished prose, formatted for a specific platform, written in a consistent voice, on a cadence that builds an audience.

## Why AI Tools Keep Failing Creators

The obvious solution is AI writing assistance. But most tools produce output that reads like AI. Competent, technically correct, and completely generic. The voice is wrong. The rhythm is wrong. The phrases are wrong.

This isn't the model's fault — it's a design problem. Generic tools use generic prompts with no understanding of who you are or how you write. They optimize for "good enough" output across all users, which means excellent output for no users.

## The Memory Hypothesis

What if your writing tool got better the more you used it? Every post you accept as "yes, this sounds like me" becomes training signal — not weights in the model, but context at generation time. Your accepted posts are retrieved, scored for relevance, and injected into the next generation prompt.

The model doesn't just know your topic. It knows your sentence length, your transition style, your tendency to end tweets with a short punchy line. It learns from evidence, not configuration.

## What This Changes

After thirty accepted posts, the editing loop collapses. You're not rewriting AI output — you're approving drafts that already sound like you. The friction that swallowed your ideas becomes a brief review step.

That's the bet. Personal AI tools that build a model of you over time, not just a model of good writing in general. The ones that get there first will be the last tools their users ever need.`;

export const SEED_POSTS: Post[] = [
  {
    id: 1,
    title: 'Building a memory layer for LLMs',
    type: 'thread',
    topic: 'llm-project',
    status: 'accepted',
    scheduledFor: 'Apr 22',
    body: [
      "1/ 3 months building Quill. Here's what surprised me about teaching an LLM to match your voice:",
      '2/ First instinct: fine-tune. Wrong. Fine-tuning kills reasoning. RAG beats it every time for style adaptation.',
      '3/ The trick: every accepted post feeds a SQLite memory table. Token-scored FTS with recency + topic bonuses.',
      '4/ At generation time, the 5 most relevant past posts get injected as style context. The model reads your work and mirrors it.',
      '5/ After ~30 accepted posts, I stopped editing output almost entirely. The voice is genuinely mine now. Wild.',
    ],
  },
  {
    id: 2,
    title: '5:45am squat rack',
    type: 'tweet',
    topic: 'gym-routine',
    status: 'published',
    scheduledFor: 'Apr 23',
    body: 'Workout done before the city woke up.\n\n5:45am squat rack. No one else. Just the bar and the math of getting stronger.\n\nConsistency over intensity. Every single time.',
  },
  {
    id: 3,
    title: 'Switching to tRPC — what I learned',
    type: 'tweet',
    topic: 'new-tech-stack',
    status: 'generated',
    scheduledFor: null,
    body: 'Switched my backend from Express to tRPC last week.\n\nEnd-to-end type safety is genuinely different. Not "nice to have" — it changes how you think about the API contract.\n\nShould have done this a year ago.',
  },
  {
    id: 4,
    title: 'Tuesday deep work session',
    type: 'tweet',
    topic: 'day-schedule',
    status: 'accepted',
    scheduledFor: 'Apr 25',
    body: 'Today was for deep work.\n\nMorning: architecture decisions, no meetings.\nAfternoon: one problem, fully solved.\nEvening: closed every tab.\n\nThis is what good days feel like.',
  },
  {
    id: 5,
    title: 'Quill v0.1 — shipping the loop',
    type: 'thread',
    topic: 'ui-product-demo',
    status: 'rejected',
    scheduledFor: null,
    body: [
      "1/ Just shipped v0.1 of Quill. Here's the full flow:",
      '2/ Input: raw notes, bullet points, half-formed thoughts. Whatever you have.',
      '3/ Topic presets handle tone: gym, build log, product demo, schedule — each tuned differently.',
      '4/ Output streams in. You watch your words become a post. Then you decide: keep it or not.',
      '5/ Accepted posts feed the memory. Next time, the model already knows how you write.',
    ],
  },
];

export const SEED_IDEAS: Idea[] = [
  {
    id: 1,
    topic: "RAG vs fine-tuning: a practitioner's take",
    notes: 'Tried both, RAG wins for style. Fine-tuning is for capability, not voice.',
    status: 'enriched',
    enrichedContent: {
      summary: 'RAG and fine-tuning address fundamentally different problems. RAG excels at injecting contextual knowledge at inference time, while fine-tuning modifies model weights for specific behavioral patterns. For personal voice matching, RAG consistently outperforms fine-tuning.',
      facts: [
        'Fine-tuning requires 500+ examples for reliable behavioral shift',
        'RAG retrieval adds 50–200ms at typical embedding scales',
        'Hybrid approaches (RAG + LoRA) now dominate enterprise production',
        'Style consistency is better served by RAG than fine-tuning in 2025 benchmarks',
      ],
      sources: [
        'RAG vs Fine-tuning: Empirical Benchmark 2025',
        'LoRA: Low-Rank Adaptation of LLMs (Hu et al.)',
        'Production LLM Patterns — a16z Research',
      ],
    },
  },
  {
    id: 2,
    topic: 'Why I stopped using frameworks',
    notes: 'Bun + tRPC + Drizzle. No magic. Just close to the metal.',
    status: 'pending',
    enrichedContent: null,
  },
  {
    id: 3,
    topic: 'Building in public: 90-day update',
    notes: 'Shipped 3 things, killed 2. What I learned about scope.',
    status: 'pending',
    enrichedContent: null,
  },
];

export const SEED_MEMORIES: Memory[] = [
  { id: 101, topic: 'llm-project',    type: 'thread', body: 'Built the memory layer. Token-scored FTS + recency weighting. Ships this week.',           date: 'Apr 22' },
  { id: 102, topic: 'gym-routine',    type: 'tweet',  body: '5:45am squat rack. Consistency over intensity. Every single time.',                         date: 'Apr 23' },
  { id: 103, topic: 'day-schedule',   type: 'tweet',  body: 'One problem, fully solved. Closed every tab. This is what good days feel like.',            date: 'Apr 25' },
  { id: 104, topic: 'new-tech-stack', type: 'tweet',  body: 'tRPC end-to-end type safety is genuinely different. Should have done this a year ago.',     date: 'Apr 20' },
];

export const SEED_ARTICLES: Article[] = [
  {
    id: 201,
    topic: 'The case for personal AI writing tools',
    status: 'done',
    title: 'The Case for Personal AI Writing Tools',
    wordCount: 1847,
    body: ARTICLE_BODY,
  },
  {
    id: 202,
    topic: 'SQLite as an application database',
    status: 'writing',
    title: null,
    wordCount: 0,
    body: null,
  },
];
