import { router } from "./trpc.js";
import { postRouter } from "./post.js";
import { ideaRouter } from "./idea.js";
import { memoryRouter } from "./memory.js";
import { articleRouter } from "./article.js";

export const appRouter = router({
  post: postRouter,
  idea: ideaRouter,
  memory: memoryRouter,
  article: articleRouter,
});

export type AppRouter = typeof appRouter;
