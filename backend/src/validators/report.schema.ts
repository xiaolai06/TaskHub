import { z } from 'zod';

export const reportQuerySchema = z.object({
  period: z.string().optional(),
  type: z.enum(['day', 'month', 'year']).optional().default('month'),
  endDate: z.string().refine(d => !d || !isNaN(Date.parse(d)), '日期格式无效').optional(),
});

export type ReportQueryInput = z.infer<typeof reportQuerySchema>;
