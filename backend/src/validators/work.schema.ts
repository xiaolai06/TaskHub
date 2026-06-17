import { z } from 'zod';

export const startTimerSchema = z.object({
  description: z.string().max(200, '描述不超过200个字符').optional(),
  taskId: z.string().optional(),
  projectId: z.string().optional(),
});

export const addTodoSchema = z.object({
  content: z.string().min(1, '内容不能为空').max(200, '待办不超过200个字符'),
});

export type StartTimerInput = z.infer<typeof startTimerSchema>;
export type AddTodoInput = z.infer<typeof addTodoSchema>;
