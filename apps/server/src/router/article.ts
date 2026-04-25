import { z } from "zod";
import { publicProcedure, router } from "./trpc.js";
import {
  createArticle,
  deleteArticle,
  getArticle,
  listArticles,
  startArticleGeneration,
} from "../services/article.js";

export const articleRouter = router({
  generate: publicProcedure
    .input(z.object({ topic: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const article = await createArticle(input.topic);
      startArticleGeneration(article.id);
      return article;
    }),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getArticle(input.id)),

  list: publicProcedure.query(() => listArticles()),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteArticle(input.id)),
});
