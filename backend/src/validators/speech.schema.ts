import { z } from 'zod';

export const transcribeSchema = z.object({
  language: z.string().max(10).optional().default('zh'),
});

export type TranscribeInput = z.infer<typeof transcribeSchema>;
