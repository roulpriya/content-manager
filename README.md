# Quill — AI-Powered Twitter Content Manager

Quill is a full-stack web app for generating, refining, and managing Twitter/X posts. It uses LLM-assisted writing, web research, and a persistent memory system to help you maintain a consistent, high-quality social media presence with minimal manual effort.

---

## What It Does

1. **Generate posts** — Write a rough note, pick a topic, and Quill turns it into a polished tweet or thread using GPT-4o.
2. **Research ideas** — Enter a topic and Quill does a web search, structures the findings (summary, key facts, sources), and generates a post from the research.
3. **Learn your style** — Every accepted post is stored in a memory database. Future generations reference that memory so writing style stays consistent over time.
4. **Track GitHub activity** — Quill pulls recent commits and PRs from GitHub and can auto-generate posts from them daily.
5. **Schedule content** — A daily cron job batch-generates posts from the draft queue and schedules them across the calendar.

---

## Architecture

This is an **npm workspaces monorepo** with two apps:

```
apps/
  server/   — tRPC standalone HTTP server on :3000  (@content-manager/server)
  client/   — React 19 + Vite 8 SPA                (@content-manager/client)
```

### Server (`apps/server/src/`)

**Entrypoint**: `index.ts` starts the HTTP server via `@trpc/server/adapters/standalone` and re-exports `AppRouter` for the client to import as a type.

**Router** (`router/`): Four procedure groups:

| Router | Procedures |
|--------|-----------|
| `post` | generate, generateCalendar, regenerate, list, updateStatus, updateTopic, delete |
| `idea` | create, enrich, list, delete |
| `memory` | list, delete, runSql, readDataDictionary, writeDataDictionary |
| `github` | recentActivity |

**Services** (`services/`):

| Service | Responsibility |
|---------|---------------|
| `content.ts` | LLM post generation — builds system prompts, invokes OpenAI, calls memory read tool |
| `post.ts` | Post CRUD, status transitions, calendar scheduling, memory write events |
| `idea.ts` | Idea CRUD, async enrichment orchestration (fire-and-forget) |
| `research.ts` | Web search via OpenAI Responses API, structured content extraction |
| `memory.ts` | Memory store search/save, memory read/write agents, SQL introspection |
| `github.ts` | GitHub API — repos, PRs, commits; formats activity for generation prompts |
| `scheduler.ts` | Cron jobs: daily batch generation (08:00 UTC) + daily GitHub post |

**Database** (`db/`): Two separate SQLite databases managed with Drizzle ORM:

- `content.db` — application state (posts, ideas)
- `memory.db` — LLM context (memory snapshots, data dictionary)

```
posts     — id, input, title, body, type, topic, status, scheduledFor, createdAt, updatedAt
ideas     — id, topic, notes, status, enrichedContent (JSON), errorMessage, createdAt, updatedAt
memories  — id, sourcePostId, input, title, body, topic, type, status, searchableText, createdAt, updatedAt
data_dict — key (PK), value, updatedAt
```

Post status flow: `idea → generated → accepted → published` (or `rejected` / `archived`)

**LLM** (`lib/llm.ts`): OpenAI client configured for `gpt-4o`.

---

### Client (`apps/client/src/`)

React 19 SPA with tRPC + React Query for data fetching. Tailwind CSS v4 via `@tailwindcss/vite` (no config file).

**Key components**:

| Component | Purpose |
|-----------|---------|
| `ComposeBox` | Text input, topic chips (built-in + custom), day stepper, research/tweet/thread buttons |
| `OutputPanel` | Post editor — status badge, copy, accept/reject/publish, topic switcher, feedback + regenerate |
| `IdeaPanel` | Research status (pending → enriching → enriched), summary + facts + sources, generate-from-idea |
| `FeedList` | Home feed — filter by type/status, sort by created or scheduled date, inline delete |
| `MemoryPanel` | Memory browser — search, status labels, delete on hover |

**Routing**: Single-page with client-side routes — `/` (compose + feed), `/posts/:id`, `/ideas/:id`, `/memories`.

---

### Type Sharing

The client imports `AppRouter` directly from the server workspace:

```ts
import type { AppRouter } from "@content-manager/server";
```

This works via npm workspace symlink. **The server must be built first** (`npm run build:server`) so `dist/` declarations exist.

The Vite dev server proxies `/trpc` → `http://localhost:3000`, so no CORS configuration is needed.

---

## Data Flow

```
User input (ComposeBox)
  → POST /trpc/post.generate
    → generateContent() calls OpenAI
      → optional: memoryRead tool queries memory.db for style context
    → post saved to content.db (status = "generated")
    → askMemoryWriteAgent() fires and forgets (saves snapshot to memory.db)
  → UI shows post
    → Accept  → status = "accepted", memory updated
    → Reject  → status = "rejected", memory removed
    → Regenerate with feedback → new OpenAI call with prior output + feedback
```

**Research flow**:

```
User enters topic (ComposeBox "Research" button)
  → idea.create + idea.enrich
    → web search via OpenAI Responses API
    → structured enrichedContent saved (JSON: summary, keyFacts, sources)
  → IdeaPanel shows enriched content
    → "Generate Post" → post.generate with research context
```

---

## Key Integrations

| Integration | Usage |
|-------------|-------|
| **OpenAI API** | `gpt-4o` for post generation; Responses API with web search for research |
| **GitHub API** | Fetch repos, PRs, commits via `GITHUB_TOKEN` |
| **SQLite** | Two databases: `content.db` (app state), `memory.db` (LLM memory) |
| **node-cron** | Daily batch generation + GitHub post at 08:00 UTC |
| **Drizzle ORM** | Type-safe queries on `content.db` |
| **tRPC** | End-to-end type-safe RPC between server and client |
| **React Query** | Client-side caching, background refetch, query invalidation |

---

## Development

```bash
# Install dependencies
npm install

# Build server first (required for type exports)
npm run build:server

# Run both apps in dev mode
npm run dev

# Typecheck all workspaces
npm run typecheck
```

> Node.js `^20.19.0` or `>=22.12.0` required (Vite 8 constraint). Use `nvm use 22`.

Individual apps:

```bash
npm run dev:server   # tRPC server on :3000
npm run dev:client   # Vite SPA with HMR
```
