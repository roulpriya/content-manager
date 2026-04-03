# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Run both server and client in dev mode
npm run dev

# Typecheck all workspaces
npm run typecheck

# Build server (required before npm install for correct type exports)
npm run build:server

# Build all workspaces
npm run build

# Per-workspace dev
npm run dev:server   # tRPC standalone server on :3000
npm run dev:client   # Vite dev server with HMR
```

> **Node.js requirement**: Vite 8 and `@vitejs/plugin-react@6` require Node.js `^20.19.0` or `>=22.12.0`. Use `nvm use 22` before running the client.

## Architecture

This is an npm workspaces monorepo with two apps:

```
apps/
  server/   — tRPC standalone HTTP server (@content-manager/server)
  client/   — React 19 + Vite 8 SPA (@content-manager/client)
```

### Type sharing between apps

The client imports the `AppRouter` type directly from the server workspace:

```ts
import type { AppRouter } from "@content-manager/server";
```

This works via npm workspace symlink (`node_modules/@content-manager/server → apps/server`). The server must be **built first** (`npm run build:server`) so the `dist/` declarations exist. After any change to the server package name or location, run `npm install` to refresh the symlink.

### tRPC wiring

- **Server** (`apps/server/src/router.ts`): defines procedures with `initTRPC`, exports `appRouter` and `AppRouter` type. `index.ts` re-exports `AppRouter` and starts the HTTP server via `createHTTPServer` from `@trpc/server/adapters/standalone`.
- **Client** (`apps/client/src/trpc.ts`): creates a typed `CreateTRPCReact<AppRouter, unknown>` client. Provider wrapping is in `main.tsx`.
- **Dev proxy**: Vite proxies `/trpc` → `http://localhost:3000` so no CORS config is needed.

### Styles

Tailwind CSS v4 — configured via `@tailwindcss/vite` plugin (no `tailwind.config.js`). Single CSS entry point at `apps/client/src/index.css` with `@import "tailwindcss"`.

### TypeScript setup

Each app has its own `tsconfig.json` with `composite: true`. There is no root `tsconfig.json`. The client tsconfig references the server tsconfig for project-reference awareness.

- Server uses `module: NodeNext` + `moduleResolution: NodeNext`
- Client uses `module: ESNext` + `moduleResolution: bundler` (Vite handles resolution)
- Server dev runner is `tsx watch` (handles `.js`→`.ts` import remapping that `--experimental-strip-types` does not)
