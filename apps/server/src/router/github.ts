import { z } from "zod";
import { fetchRecentGitHubActivity } from "../services/github.js";
import { publicProcedure, router } from "./trpc.js";

export const githubRouter = router({
  recentActivity: publicProcedure
    .input(
      z
        .object({
          days: z.number().int().min(1).max(90).optional(),
          repositories: z.number().int().min(1).max(20).optional(),
          pullRequests: z.number().int().min(1).max(20).optional(),
          commits: z.number().int().min(1).max(20).optional(),
        })
        .optional()
    )
    .query(({ input }) =>
      fetchRecentGitHubActivity(input?.days, {
        repositories: input?.repositories,
        pullRequests: input?.pullRequests,
        commits: input?.commits,
      })
    ),
});
