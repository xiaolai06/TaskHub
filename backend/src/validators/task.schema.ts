import { z } from 'zod';

const dateField = z.string().refine((v) => !isNaN(Date.parse(v)), { message: '日期格式不正确' }).optional();

export const createTaskSchema = z.object({
  title: z.string().min(1, '任务标题不能为空').max(200, '任务标题不超过200个字符'),
  description: z.string().max(1000, '描述不超过1000个字符').optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED']).optional().default('TODO'),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW']).optional().default('MEDIUM'),
  estimatedHours: z.number().min(0, '预估工时不能为负数').optional().default(0),
  actualHours: z.number().min(0, '实际工时不能为负数').optional(),
  cost: z.number().int().min(0, '花销不能为负数').optional().default(0),
  costNote: z.string().max(200, '花销说明不超过200个字符').optional(),
  blockedReason: z.string().max(200, '阻塞原因不超过200个字符').optional(),
  startDate: dateField,
  dueDate: dateField,
  projectId: z.string().min(1, '项目ID不能为空'),
  assigneeId: z.string().optional(),
  parentId: z.string().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1, '任务标题不能为空').max(200).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED']).optional(),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  estimatedHours: z.number().min(0).optional(),
  actualHours: z.number().min(0).optional(),
  cost: z.number().int().min(0).optional(),
  costNote: z.string().max(200).optional(),
  blockedReason: z.string().max(200).optional(),
  startDate: dateField,
  dueDate: dateField,
  completedAt: dateField,
  assigneeId: z.string().optional(),
  parentId: z.string().nullable().optional(),
  progress: z.number().min(0).max(100).optional(),
});

export const updateTaskStatusSchema = z.object({
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED']),
  blockedReason: z.string().max(200).optional(),
});

/** 路由层筛选参数校验 */
export const taskQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED']).optional(),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  projectId: z.string().optional(),
  assigneeId: z.string().optional(),
  parentId: z.string().optional(),
  search: z.string().max(100).optional(),
  dueDateFrom: z.string().optional(),
  dueDateTo: z.string().optional(),
  sortBy: z.enum(['priority', 'dueDate', 'createdAt', 'estimatedHours', 'title']).optional().default('priority'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskQueryInput = z.infer<typeof taskQuerySchema>;
