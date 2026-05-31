// 定时任务管理
import { z } from 'zod';

export const createCronJobSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(50, '名称最长50字'),
  cronExpr: z.string().min(1, 'Cron 表达式不能为空'),
  timezone: z.string().default('Asia/Shanghai'),
  action: z.enum(['NOTIFY', 'AI_ANALYSIS', 'WEBHOOK'], { message: '无效的动作类型' }),
  config: z.string().default('{}'),
});

export const updateCronJobSchema = createCronJobSchema.partial().extend({
  enabled: z.boolean().optional(),
});

export const cronJobFiltersSchema = z.object({
  enabled: z.preprocess(
    (v) => v === 'true' ? true : v === 'false' ? false : undefined,
    z.boolean().optional(),
  ),
});

export type CreateCronJobInput = z.infer<typeof createCronJobSchema>;
export type UpdateCronJobInput = z.infer<typeof updateCronJobSchema>;
