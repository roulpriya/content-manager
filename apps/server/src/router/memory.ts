import { z } from "zod";
import {
  deleteMemory,
  listMemories,
  readMemoryDataDictionaryTool,
  runMemorySqlTool,
  writeMemoryDataDictionaryTool,
} from "../services/memory.js";
import { publicProcedure, router } from "./trpc.js";

export const memoryRouter = router({
  list: publicProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(({ input }) => listMemories(input?.limit)),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteMemory(input.id)),

  runSql: publicProcedure
    .input(z.object({
      sql: z.string().min(1),
      params: z.array(z.unknown()).optional(),
    }))
    .mutation(({ input }) => runMemorySqlTool(input.sql, input.params)),

  readDataDictionary: publicProcedure.query(() => readMemoryDataDictionaryTool()),

  writeDataDictionary: publicProcedure
    .input(z.object({
      entries: z.array(z.object({
        key: z.string().min(1),
        value: z.string(),
      })),
      replace: z.boolean().optional(),
    }))
    .mutation(({ input }) => writeMemoryDataDictionaryTool(input.entries, input.replace)),
});
