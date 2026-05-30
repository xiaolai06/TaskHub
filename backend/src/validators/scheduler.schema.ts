import { z } from 'zod';

// ======================== 排期计算 ========================
export const calculateScheduleSchema = z.object({
  projectId: z.string().min(1, '项目 ID 不能为空'),
  dailyHourLimit: z
    .number()
    .min(1, '每日工时上限至少 1 小时')
    .max(24, '每日工时上限不能超过 24 小时')
    .optional()
    .default(8),
});

export type CalculateScheduleInput = z.infer<typeof calculateScheduleSchema>;

// ======================== 插单模拟 ========================
export const insertionSimulationSchema = z.object({
  projectId: z.string().min(1, '项目 ID 不能为空'),
  newTask: z.object({
    title: z.string().min(1, '任务标题不能为空'),
    priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
    estimatedHours: z
      .number()
      .min(0.5, '预估工时至少 0.5 小时')
      .max(200, '预估工时不能超过 200 小时'),
    dueDate: z.string().optional(),
    startDate: z.string().optional(),
  }),
  dailyHourLimit: z
    .number()
    .min(1)
    .max(24)
    .optional()
    .default(8),
});

export type InsertionSimulationInput = z.infer<typeof insertionSimulationSchema>;

// ======================== 延期查询 ========================
export const delayQuerySchema = z.object({
  projectId: z.string().min(1, '项目 ID 不能为空'),
});

export type DelayQueryInput = z.infer<typeof delayQuerySchema>;

// ======================== 冲突查询 ========================
export const conflictQuerySchema = z.object({
  projectId: z.string().min(1, '项目 ID 不能为空'),
  dailyHourLimit: z
    .number()
    .min(1)
    .max(24)
    .optional()
    .default(8),
});

export type ConflictQueryInput = z.infer<typeof conflictQuerySchema>;
