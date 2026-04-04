import { z } from "zod";
import { publicProcedure, router } from "./trpc.js";
import {
  createAndGenerate,
  deletePost,
  listPosts,
  regenerate,
  updateStatus,
} from "../services/post.js";

export const postRouter = router({
  generate: publicProcedure
    .input(
      z.object({
        input: z.string().min(1),
        type: z.enum(["tweet", "thread"]),
      })
    )
    .mutation(({ input }) => createAndGenerate(input.input, input.type)),

  regenerate: publicProcedure
    .input(z.object({ id: z.number(), feedback: z.string().optional() }))
    .mutation(({ input }) => regenerate(input.id, input.feedback)),

  list: publicProcedure
    .input(z.object({ status: z.string().optional() }))
    .query(({ input }) => listPosts(input.status)),

  updateStatus: publicProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["idea", "generated", "approved", "posted"]),
      })
    )
    .mutation(({ input }) => updateStatus(input.id, input.status)),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deletePost(input.id)),
});
