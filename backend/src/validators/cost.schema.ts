import { z } from 'zod';

const dateField = z.string().refine(
  (value) => !Number.isNaN(Date.parse(value)),
  { message: '日期格式不正确' },
);

export const createCostSchema = z.object({
  amount: z.number().int().min(1, '金额必须大于0'),
  category: z.enum(['LABOR', 'MATERIAL', 'OVERHEAD', 'OTHER'], { message: '类别必填' }),
  description: z.string().min(1, '描述不能为空').max(200, '描述不超过200个字符'),
  date: dateField,
  taskId: z.string().optional(),
});

export const updateCostSchema = z.object({
  amount: z.number().int().min(1, '金额必须大于0').optional(),
  category: z.enum(['LABOR', 'MATERIAL', 'OVERHEAD', 'OTHER']).optional(),
  description: z.string().min(1, '描述不能为空').max(200, '描述不超过200个字符').optional(),
  date: dateField.optional(),
});

export const costQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  category: z.enum(['LABOR', 'MATERIAL', 'OVERHEAD', 'OTHER']).optional(),
});

export type CreateCostInput = z.infer<typeof createCostSchema>;
export type UpdateCostInput = z.infer<typeof updateCostSchema>;
export type CostQueryInput = z.infer<typeof costQuerySchema>;
