import { z } from 'zod';

const dateField = z.string().refine(
  (value) => !Number.isNaN(Date.parse(value)),
  { message: '日期格式不正确' },
).optional();

const requiredDateField = z.string().refine(
  (value) => !Number.isNaN(Date.parse(value)),
  { message: '日期格式不正确' },
);

export const createProjectSchema = z.object({
  name: z.string().min(1, '项目名称不能为空').max(100, '项目名称不超过100个字符'),
  description: z.string().max(500, '描述不超过500个字符').optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED']).optional().default('ACTIVE'),
  budget: z.number().int().min(0, '报价不能为负数').optional(),
  startDate: requiredDateField,
  endDate: dateField,
  customerId: z.string().optional(),
  expenseNote: z.string().max(500, '成本备注不超过500个字符').optional(),
  rewardNote: z.string().max(500, '订单备注不超过500个字符').optional(),
  type: z.string().max(20, '类型标签不超过20个字符').optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1, '项目名称不能为空').max(100, '项目名称不超过100个字符').optional(),
  description: z.string().max(500, '描述不超过500个字符').optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
  budget: z.number().int().min(0, '报价不能为负数').optional(),
  startDate: dateField,
  endDate: dateField,
  customerId: z.string().nullable().optional(),
  expenseNote: z.string().max(500, '成本备注不超过500个字符').optional(),
  rewardNote: z.string().max(500, '订单备注不超过500个字符').optional(),
  type: z.string().max(20, '类型标签不超过20个字符').optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;