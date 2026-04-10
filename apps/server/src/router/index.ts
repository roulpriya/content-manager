import { router } from "./trpc.js";
import { postRouter } from "./post.js";
import { ideaRouter } from "./idea.js";
import { memoryRouter } from "./memory.js";
import { githubRouter } from "./github.js";

export const appRouter = router({
  post: postRouter,
  idea: ideaRouter,
  memory: memoryRouter,
  github: githubRouter,
});

export type AppRouter = typeof appRouter;
