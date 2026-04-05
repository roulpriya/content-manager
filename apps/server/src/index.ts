import "dotenv/config";
import { createServer } from "http";
import { createHTTPHandler } from "@trpc/server/adapters/standalone";
import sirv from "sirv";
import { appRouter } from "./router/index.js";
import { syncApprovedPostsToMemoryStore } from "./services/memory.js";
import { startScheduler } from "./services/scheduler.js";

export type { AppRouter } from "./router/index.js";
export type { Post, Idea, PostTopic, Memory } from "./db/schema.js";
export type { EnrichedContent } from "./services/research.js";

const trpcHandler = createHTTPHandler({
  router: appRouter,
  createContext() {
    return {};
  },
  basePath: "/trpc/",
});

const serveStatic = process.env.CLIENT_DIST_PATH
  ? sirv(process.env.CLIENT_DIST_PATH, { single: true })
  : null;

const server = createServer((req, res) => {
  if (req.url?.startsWith("/trpc")) {
    trpcHandler(req, res);
  } else if (serveStatic) {
    serveStatic(req, res);
  } else {
    res.statusCode = 404;
    res.end("Not found");
  }
});

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
server.listen(port);
console.log(`Server listening on http://localhost:${port}`);

syncApprovedPostsToMemoryStore().then((count) => {
  console.log(`[memory] Synced ${count} approved posts into memory store`);
});

startScheduler();
