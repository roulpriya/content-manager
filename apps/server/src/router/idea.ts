import { z } from "zod";
import { publicProcedure, router } from "./trpc.js";
import { createIdea, listIdeas, deleteIdea, startEnrichment } from "../services/idea.js";

export const ideaRouter = router({
  create: publicProcedure
    .input(z.object({ topic: z.string().min(1), notes: z.string().optional() }))
    .mutation(({ input }) => createIdea(input.topic, input.notes)),

  enrich: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => startEnrichment(input.id)),

  list: publicProcedure.query(() => listIdeas()),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteIdea(input.id)),
});
