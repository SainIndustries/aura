import { z } from "zod";

export const createAgentSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  personality: z.string().max(1000).optional(),
  goal: z.string().max(1000).optional(),
  heartbeatEnabled: z.boolean(),
  heartbeatCron: z.string().optional(),
  // LLM Configuration
  llmProvider: z.string().optional(),
  llmModel: z.string().optional(),
  llmTemperature: z.number().min(0).max(1).optional(),
  llmCustomEndpoint: z.string().optional(),
});

export type CreateAgentData = z.infer<typeof createAgentSchema>;
