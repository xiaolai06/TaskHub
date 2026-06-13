import { z } from 'zod';

export const financeSummarySchema = z.object({
  period: z.string().optional(),
  type: z.enum(['day', 'month', 'year']).optional().default('month'),
});

export type FinanceSummaryInput = z.infer<typeof financeSummarySchema>;
