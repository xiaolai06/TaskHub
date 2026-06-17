import { z } from 'zod';

export const createGreetingSchema = z.object({
  content: z.string().min(1, '语录内容不能为空').max(500, '语录不超过500个字符'),
  hourStart: z.number().int().min(0).max(23).optional(),
  hourEnd: z.number().int().min(0).max(23).optional(),
});

export const updateGreetingSchema = z.object({
  content: z.string().min(1, '语录内容不能为空').max(500, '语录不超过500个字符').optional(),
  hourStart: z.number().int().min(0).max(23).optional(),
  hourEnd: z.number().int().min(0).max(23).optional(),
});

export type CreateGreetingInput = z.infer<typeof createGreetingSchema>;
export type UpdateGreetingInput = z.infer<typeof updateGreetingSchema>;
