import { z } from 'zod';

// ======================== 目标校验 ========================

const metricTypeEnum = z.enum(
  ['REVENUE', 'PROFIT', 'NEW_ORDERS', 'PROJECT_COUNT', 'DELIVERY_RATE', 'MILESTONE'],
  { message: '指标类型无效' },
);

export const createGoalSchema = z.object({
  title: z.string().min(1, '目标标题不能为空').max(100, '标题最多100字'),
  description: z.string().max(500, '描述最多500字').optional(),
  type: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY'], { message: '目标周期无效' }),
  metricType: metricTypeEnum,
  targetValue: z.number().positive('目标值必须大于0').nullable().optional(),
  unit: z.string().max(10, '单位最多10字').nullable().optional(),
  progressMode: z.enum(['AUTO', 'MANUAL', 'MILESTONE']).optional(),
  startDate: z.string().refine(d => !isNaN(Date.parse(d)), '开始日期格式无效'),
  endDate: z.string().refine(d => !isNaN(Date.parse(d)), '结束日期格式无效'),
  projectId: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
}).refine(data => new Date(data.endDate) > new Date(data.startDate), {
  message: '结束日期必须晚于开始日期',
  path: ['endDate'],
}).refine(
  data => data.metricType === 'MILESTONE' || data.targetValue != null,
  { message: '非里程碑类型目标必须设置目标值', path: ['targetValue'] },
);

export const updateGoalSchema = z.object({
  title: z.string().min(1, '目标标题不能为空').max(100).optional(),
  description: z.string().max(500).optional(),
  type: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
  metricType: metricTypeEnum.optional(),
  targetValue: z.number().positive().nullable().optional(),
  unit: z.string().max(10).nullable().optional(),
  progressMode: z.enum(['AUTO', 'MANUAL', 'MILESTONE']).optional(),
  status: z.enum(['ACTIVE', 'ABANDONED', 'AT_RISK']).optional(),
  startDate: z.string().refine(d => !isNaN(Date.parse(d))).optional(),
  endDate: z.string().refine(d => !isNaN(Date.parse(d))).optional(),
  projectId: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  reviewNote: z.string().max(1000).optional(),
  nextAction: z.string().max(1000).optional(),
});

export const updateProgressSchema = z.object({
  currentValue: z.number().min(0, '进度值不能为负'),
});

// ======================== 进度日记校验 ========================

export const createProgressLogSchema = z.object({
  value: z.number()
    .positive('进度值必须大于0')
    .max(999999999, '进度值过大，请检查'),
  note: z.string().max(200, '备注最多200字').optional(),
  date: z.string().refine(d => !isNaN(Date.parse(d)), '日期格式无效').optional(),
});

// ======================== 里程碑校验 ========================

export const createMilestoneSchema = z.object({
  title: z.string().min(1, '里程碑标题不能为空').max(100),
  targetValue: z.number().positive('目标值必须大于0').optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateMilestoneSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  targetValue: z.number().positive().optional(),
  completed: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// ======================== 类型导出 ========================

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type UpdateProgressInput = z.infer<typeof updateProgressSchema>;
export type CreateProgressLogInput = z.infer<typeof createProgressLogSchema>;
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
