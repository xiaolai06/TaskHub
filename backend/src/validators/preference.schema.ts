import { z } from 'zod';

export const updatePreferenceSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.enum(['zh-CN', 'en-US']).optional(),
  timezone: z.string().max(50).optional(),
  dateFormat: z.string().max(20).optional(),
  startPage: z.string().max(50).optional(),
  taskReminder: z.boolean().optional(),
  reminderDays: z.number().int().min(0).max(30).optional(),
  projectNotify: z.boolean().optional(),
  systemNotify: z.boolean().optional(),
  emailNotify: z.boolean().optional(),
  dndStart: z.string().regex(/^\d{2}:\d{2}$/, '时间格式 HH:mm').optional(),
  dndEnd: z.string().regex(/^\d{2}:\d{2}$/, '时间格式 HH:mm').optional(),
  sidebarCollapsed: z.boolean().optional(),
  pageSize: z.number().int().min(5).max(100).optional(),
  defaultView: z.string().max(30).optional(),
  showStats: z.boolean().optional(),
});

export type UpdatePreferenceInput = z.infer<typeof updatePreferenceSchema>;
