import "dotenv/config";
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { appRouter } from "./router/index.js";
import { startScheduler } from "./services/scheduler.js";

export type { AppRouter } from "./router/index.js";
export type { Post, Idea } from "./db/schema.js";
export type { EnrichedContent } from "./services/research.js";

const server = createHTTPServer({
  router: appRouter,
  createContext() {
    return {};
  },
});

server.listen(3000);
console.log("tRPC server listening on http://localhost:3000");

startScheduler();
