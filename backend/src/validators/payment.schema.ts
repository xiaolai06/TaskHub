import { z } from 'zod';

const dateField = z.string().refine(
  (value) => !Number.isNaN(Date.parse(value)),
  { message: '日期格式不正确' },
);

export const createPaymentSchema = z.object({
  amount: z.number().int().min(1, '金额必须大于0'),
  type: z.enum(['DOWN_PAYMENT', 'PROGRESS', 'FINAL', 'ADJUSTMENT', 'OTHER'], {
    message: '回款类型必填',
  }),
  method: z.enum(['BANK_TRANSFER', 'ALIPAY', 'WECHAT', 'CASH', 'OTHER']).optional(),
  receivedAt: dateField,
  projectId: z.string().min(1, '项目不能为空'),
  note: z.string().max(500, '备注不超过500个字符').optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
