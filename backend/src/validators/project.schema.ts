import { z } from 'zod';

// 日期校验：接受 YYYY-MM-DD 或 ISO 8601 格式
const dateField = z.string().refine(
  (v) => !isNaN(Date.parse(v)),
  { message: '日期格式不正确' },
).optional();

export const createProjectSchema = z.object({
  name: z.string().min(1, '项目名称不能为空').max(100, '项目名称不超过100个字符'),
  description: z.string().max(500, '描述不超过500个字符').optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED']).optional().default('ACTIVE'),
  budget: z.number().int().min(0, '预算不能为负数').optional(),
  startDate: dateField,
  endDate: dateField,
  customerId: z.string().optional(),
  expenseNote: z.string().max(500, '支出说明不超过500个字符').optional(),
  rewardNote: z.string().max(500, '报酬说明不超过500个字符').optional(),
  type: z.string().max(20, '类型标签不超过20个字符').optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1, '项目名称不能为空').max(100, '项目名称不超过100个字符').optional(),
  description: z.string().max(500, '描述不超过500个字符').optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
  budget: z.number().int().min(0, '预算不能为负数').optional(),
  startDate: dateField,
  endDate: dateField,
  customerId: z.string().nullable().optional(),
  expenseNote: z.string().max(500).optional(),
  rewardNote: z.string().max(500).optional(),
  type: z.string().max(20).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
