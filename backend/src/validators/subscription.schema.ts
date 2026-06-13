import { z } from 'zod';

const dateField = z.string().refine(
  (value) => !Number.isNaN(Date.parse(value)),
  { message: '日期格式不正确' },
);

export const createSubscriptionSchema = z.object({
  name: z.string().min(1, '服务名称不能为空').max(100, '名称不超过100个字符'),
  category: z.enum(['SOFTWARE', 'CLOUD', 'DOMAIN', 'TOOL', 'MEDIA', 'OTHER'], {
    message: '订阅类别必填',
  }),
  amount: z.number().int().min(1, '金额必须大于0'),
  currency: z.enum(['CNY', 'USD', 'EUR']).optional().default('CNY'),
  exchangeRate: z.number().positive('汇率必须大于0').optional().default(1.0),
  cycle: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY'], { message: '扣费周期必填' }),
  startDate: dateField,
  nextBillingAt: dateField,
  autoRenew: z.boolean().optional().default(true),
  url: z.string().url('URL 格式不正确').optional().or(z.literal('')),
  note: z.string().max(500, '备注不超过500个字符').optional(),
});

export const updateSubscriptionSchema = z.object({
  name: z.string().min(1, '服务名称不能为空').max(100, '名称不超过100个字符').optional(),
  category: z.enum(['SOFTWARE', 'CLOUD', 'DOMAIN', 'TOOL', 'MEDIA', 'OTHER']).optional(),
  amount: z.number().int().min(1, '金额必须大于0').optional(),
  currency: z.enum(['CNY', 'USD', 'EUR']).optional(),
  exchangeRate: z.number().positive('汇率必须大于0').optional(),
  cycle: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
  startDate: dateField.optional(),
  nextBillingAt: dateField.optional(),
  autoRenew: z.boolean().optional(),
  url: z.string().url('URL 格式不正确').optional().or(z.literal('')),
  note: z.string().max(500, '备注不超过500个字符').optional(),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
