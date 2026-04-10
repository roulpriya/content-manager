import { z } from "zod";
import { publicProcedure, router } from "./trpc.js";
import {
  createCalendar,
  createAndGenerate,
  deletePost,
  listPosts,
  regenerate,
  updateTopic,
  updateStatus,
} from "../services/post.js";
import { POST_TOPICS } from "../db/schema.js";

export const postRouter = router({
  generate: publicProcedure
    .input(
      z.object({
        input: z.string().min(1),
        type: z.enum(["tweet", "thread"]),
        topic: z.enum(POST_TOPICS),
      })
    )
    .mutation(({ input }) => createAndGenerate(input.input, input.type, input.topic)),

  generateCalendar: publicProcedure
    .input(
      z.object({
        input: z.string().min(1),
        type: z.enum(["tweet", "thread"]),
        topic: z.enum(POST_TOPICS),
        days: z.number().min(1).max(30),
      })
    )
    .mutation(({ input }) =>
      createCalendar(input.input, input.type, input.topic, input.days)
    ),

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
        status: z.enum(["idea", "generated", "accepted", "published", "rejected"]),
      })
    )
    .mutation(({ input }) => updateStatus(input.id, input.status)),

  updateTopic: publicProcedure
    .input(
      z.object({
        id: z.number(),
        topic: z.enum(POST_TOPICS),
      })
    )
    .mutation(({ input }) => updateTopic(input.id, input.topic)),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deletePost(input.id)),
});
