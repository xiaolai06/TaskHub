import { prisma } from '../server';
import { NotFoundError } from '../utils/errors';
import type { CreateCronJobInput, UpdateCronJobInput } from '../validators/cron-job.schema';

export const SYSTEM_JOBS = [
  {
    name: '到期提醒',
    cronExpr: '0 8 * * *',
    action: 'NOTIFY',
    config: JSON.stringify({
      type: 'due_reminder',
      description: '检查逾期任务并发送到期提醒',
      dataQueries: ['detectDelays'],
    }),
  },
  {
    name: '成本预警',
    cronExpr: '0 10 * * *',
    action: 'NOTIFY',
    config: JSON.stringify({
      type: 'cost_alert',
      description: '检查订单成本是否超过报价的 80%，发送预警通知',
      dataQueries: ['costSummary'],
    }),
  },
  {
    name: '晨间简报',
    cronExpr: '0 8 * * *',
    action: 'AI_ANALYSIS',
    config: JSON.stringify({
      type: 'morning',
      description: '每日早间分析项目、任务和客户数据，生成行动建议',
      aiPrompt: 'system-morning.txt',
      dataQueries: ['getStats', 'detectDelays', 'recentConversations'],
    }),
  },
  {
    name: '客户雷达',
    cronExpr: '0 9 * * *',
    action: 'AI_ANALYSIS',
    config: JSON.stringify({
      type: 'client_radar',
      description: '扫描客户沟通间隔，提示需要跟进的客户',
      aiPrompt: 'system-client-radar.txt',
      dataQueries: ['customerList', 'communications', 'projectStatus'],
    }),
  },
  {
    name: '订单利润简报',
    cronExpr: '0 10 * * *',
    action: 'AI_ANALYSIS',
    config: JSON.stringify({
      type: 'finance_pulse',
      description: '分析报价、成本、利润和月入款，生成经营建议',
      aiPrompt: 'system-finance-pulse.txt',
      dataQueries: ['costSummary', 'profitAnalysis', 'cashflow'],
    }),
  },
  {
    name: '自动周报',
    cronExpr: '0 9 * * 1',
    action: 'AI_ANALYSIS',
    config: JSON.stringify({
      type: 'weekly_report',
      description: '每周一自动生成上周工作周报',
      aiPrompt: 'weekly-report.txt',
      dataQueries: ['dashboardStats', 'weeklyTasks', 'weeklyCosts', 'conversations'],
    }),
  },
  {
    name: '记忆沉淀',
    cronExpr: '0 20 * * 0',
    action: 'AI_ANALYSIS',
    config: JSON.stringify({
      type: 'memory_keeper',
      description: '从本周对话中提取偏好、决策和重要信息',
      aiPrompt: 'memory-extract.txt',
      dataQueries: ['weeklyConversations'],
    }),
  },
  {
    name: '业务体检',
    cronExpr: '0 10 * * 0',
    action: 'AI_ANALYSIS',
    config: JSON.stringify({
      type: 'health_check',
      description: '从订单利润、客户、项目和目标四个维度评估业务健康度',
      aiPrompt: 'health-check.txt',
      dataQueries: ['dashboardStats', 'goals', 'customers', 'finances'],
    }),
  },
] as const;

export async function findAll(userId: string, filters?: { enabled?: boolean }) {
  const where: Record<string, unknown> = { userId };
  if (filters?.enabled !== undefined) where.enabled = filters.enabled;
  return prisma.cronJob.findMany({
    where,
    orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
  });
}

export async function findById(userId: string, id: string) {
  const record = await prisma.cronJob.findUnique({ where: { id } });
  if (!record || record.userId !== userId) throw new NotFoundError('定时任务');
  return record;
}

export async function create(userId: string, data: CreateCronJobInput) {
  return prisma.cronJob.create({
    data: {
      name: data.name,
      cronExpr: data.cronExpr,
      timezone: data.timezone,
      action: data.action,
      config: data.config,
      isSystem: false,
      user: { connect: { id: userId } },
    },
  });
}

export async function update(userId: string, id: string, data: UpdateCronJobInput) {
  const existing = await findById(userId, id);
  return prisma.cronJob.update({ where: { id: existing.id }, data });
}

export async function remove(userId: string, id: string) {
  const existing = await findById(userId, id);
  if (existing.isSystem) throw new Error('系统预置任务不可删除');
  return prisma.cronJob.delete({ where: { id } });
}

export async function ensureSystemJobs(userId: string) {
  let created = 0;
  for (const job of SYSTEM_JOBS) {
    const existing = await prisma.cronJob.findFirst({ where: { userId, name: job.name, isSystem: true } });
    if (!existing) {
      await prisma.cronJob.create({
        data: {
          name: job.name,
          cronExpr: job.cronExpr,
          action: job.action,
          config: job.config,
          isSystem: true,
          user: { connect: { id: userId } },
        },
      });
      created++;
    }
  }
  return { created };
}