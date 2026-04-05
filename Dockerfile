# ── Stage 1: install all dependencies ────────────────────────────────────────
FROM node:22-alpine AS deps

# better-sqlite3 requires a C++ toolchain to compile its native addon
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/
COPY apps/client/package.json ./apps/client/

RUN npm ci

# ── Stage 2: build server + client ───────────────────────────────────────────
FROM deps AS builder

COPY apps/server ./apps/server
COPY apps/client ./apps/client

# Server must be built first — client imports its types
RUN npm run build:server && npm run build:client

# ── Stage 3: production image ─────────────────────────────────────────────────
FROM node:22-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install production deps only (recompiles better-sqlite3 for the target arch)
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/
COPY apps/client/package.json ./apps/client/
RUN npm ci --workspace=apps/server --omit=dev

# Copy built server
COPY --from=builder /app/apps/server/dist ./apps/server/dist

# Copy built client — served as static files by the server
COPY --from=builder /app/apps/client/dist ./public

ENV NODE_ENV=production
ENV CLIENT_DIST_PATH=/app/public

EXPOSE 3000

CMD ["node", "apps/server/dist/index.js"]
