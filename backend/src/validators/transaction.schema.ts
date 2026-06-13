import { z } from 'zod';

const dateField = z.string().refine(
  (value) => !Number.isNaN(Date.parse(value)),
  { message: '日期格式不正确' },
);

export const createTransactionSchema = z.object({
  amount: z.number().int().min(1, '金额必须大于0'),
  direction: z.enum(['INCOME', 'EXPENSE'], { message: '收支方向必填' }),
  category: z.string().min(1, '类别不能为空'),
  description: z.string().min(1, '描述不能为空').max(200, '描述不超过200个字符'),
  date: dateField,
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  note: z.string().max(500, '备注不超过500个字符').optional(),
});

export const updateTransactionSchema = z.object({
  amount: z.number().int().min(1, '金额必须大于0').optional(),
  category: z.string().min(1, '类别不能为空').optional(),
  description: z.string().min(1, '描述不能为空').max(200, '描述不超过200个字符').optional(),
  date: dateField.optional(),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  note: z.string().max(500, '备注不超过500个字符').optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
