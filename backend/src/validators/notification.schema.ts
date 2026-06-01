import { z } from 'zod';

export const notificationFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(['TASK_DUE', 'COST_ALERT', 'PROJECT_CHANGE', 'AI_INSIGHT', 'AI_REPORT', 'SYSTEM']).optional(),
  read: z.preprocess(
    (v) => (v === 'true' ? true : v === 'false' ? false : undefined),
    z.boolean().optional(),
  ),
});

export type NotificationFilters = z.infer<typeof notificationFiltersSchema>;
