import { router } from "./trpc.js";
import { postRouter } from "./post.js";
import { ideaRouter } from "./idea.js";

export const appRouter = router({
  post: postRouter,
  idea: ideaRouter,
});

export type AppRouter = typeof appRouter;
