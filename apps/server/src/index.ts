import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { appRouter } from "./router.js";

export type { AppRouter } from "./router.js";

const server = createHTTPServer({
  router: appRouter,
  createContext() {
    return {};
  },
});

server.listen(3000);
console.log("tRPC server listening on http://localhost:3000");
