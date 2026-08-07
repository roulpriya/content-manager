# Content Manager

An AI-powered content creation tool for Twitter/X posts, threads, and long-form articles. It turns rough notes into polished, on-brand content — and learns your writing style over time.

## What it does

- **Generate tweets & threads** from bullet points or rough notes, tuned to specific topics (gym logs, LLM projects, day schedules, UI demos, etc.)
- **Regenerate with feedback** — paste in notes, get a draft, give feedback, get a better version
- **Multi-day calendar** — generate a full week or month of posts from a single theme, each one distinct
- **Idea enrichment** — paste a topic, get a web-researched summary with key facts and links before writing
- **Long-form articles** — deep web research + Medium-quality writing in one click, output in Markdown
- **Style memory** — accepted posts are saved and used to match your phrasing and rhythm in future generations
- **Daily scheduler** — auto-generates posts from your ideas queue every morning at 08:00

## Setup

Create `apps/server/.env`:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o   # optional, defaults to gpt-4o
```

Then run:

```bash
docker compose up --build
```

The app runs at `http://localhost:3000`. SQLite data persists in `./data/` across restarts.

## Topics

When creating a post, pick the topic that fits — each has its own tone and structure rules:

| Topic | Best for |
|---|---|
| `general` | Anything that doesn't fit a specific category |
| `day-schedule` | Daily schedule posts |
| `gym-routine` | Workout logs |
| `llm-project` | AI/LLM projects you've built |
| `new-tech-stack` | Tools or stacks you explored |
| `ui-product-demo` | UI builds, product launches, demos |

## Post lifecycle

```
idea → generated → accepted / rejected
                 ↘ published
```

Accepting a post saves it to the style memory store. Rejecting removes it from memory.

## Local development

```bash
nvm use 22
npm install
npm run dev          # server on :3000, client on :5173
npm run typecheck    # check all workspaces
```
