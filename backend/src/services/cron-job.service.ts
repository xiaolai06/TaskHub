import { prisma } from '../server';
import { NotFoundError } from '../utils/errors';
import type { CreateCronJobInput, UpdateCronJobInput } from '../validators/cron-job.schema';

// ═══ 系统预置的 6 个定时任务定义 ═══

export const SYSTEM_JOBS = [
  {
    name: '到期提醒',
    cronExpr: '0 8 * * *',
    action: 'NOTIFY',
    config: JSON.stringify({
      type: 'due_reminder',
      description: '检查逾期任务，发送到期提醒通知',
      dataQueries: ['detectDelays'],
    }),
  },
  {
    name: '成本预警',
    cronExpr: '0 10 * * *',
    action: 'NOTIFY',
    config: JSON.stringify({
      type: 'cost_alert',
      description: '检查项目成本是否超过预算的80%，发送预警通知',
      dataQueries: ['costSummary'],
    }),
  },
  {
    name: '☀️ 晨间简报',
    cronExpr: '0 8 * * *',
    action: 'AI_ANALYSIS',
    config: JSON.stringify({
      type: 'morning',
      description: '每日早间分析项目/任务/客户数据，AI 提供行动建议',
      aiPrompt: 'system-morning.txt',
      dataQueries: ['getStats', 'detectDelays', 'recentConversations'],
    }),
  },
  {
    name: '📡 客户雷达',
    cronExpr: '0 9 * * *',
    action: 'AI_ANALYSIS',
    config: JSON.stringify({
      type: 'client_radar',
      description: '扫描客户沟通间隔，AI 分析需要联系的客户',
      aiPrompt: 'system-client-radar.txt',
      dataQueries: ['customerList', 'communications', 'projectStatus'],
    }),
  },
  {
    name: '💰 财务脉搏',
    cronExpr: '0 10 * * *',
    action: 'AI_ANALYSIS',
    config: JSON.stringify({
      type: 'finance_pulse',
      description: '分析成本/利润/预算，AI 给出财务建议',
      aiPrompt: 'system-finance-pulse.txt',
      dataQueries: ['costSummary', 'profitAnalysis', 'cashflow'],
    }),
  },
  {
    name: '📊 自动周报',
    cronExpr: '0 9 * * 1',
    action: 'AI_ANALYSIS',
    config: JSON.stringify({
      type: 'weekly_report',
      description: '每周一 AI 自动生成上周工作周报',
      aiPrompt: 'weekly-report.txt',
      dataQueries: ['dashboardStats', 'weeklyTasks', 'weeklyCosts', 'conversations'],
    }),
  },
  {
    name: '🧠 记忆沉淀',
    cronExpr: '0 20 * * 0',
    action: 'AI_ANALYSIS',
    config: JSON.stringify({
      type: 'memory_keeper',
      description: '从本周对话中 AI 提取偏好/决策/信息，沉淀到记忆库',
      aiPrompt: 'memory-extract.txt',
      dataQueries: ['weeklyConversations'],
    }),
  },
  {
    name: '🫀 业务体检',
    cronExpr: '0 10 * * 0',
    action: 'AI_ANALYSIS',
    config: JSON.stringify({
      type: 'health_check',
      description: '从财务/客户/项目/目标四维度评估业务健康度',
      aiPrompt: 'health-check.txt',
      dataQueries: ['dashboardStats', 'goals', 'customers', 'finances'],
    }),
  },
] as const;

// ═══ CRUD ═══

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
    data: { ...data, userId, isSystem: false },
  });
}

export async function update(userId: string, id: string, data: UpdateCronJobInput) {
  const existing = await findById(userId, id);
  return prisma.cronJob.update({ where: { id: existing.id }, data });
}

export async function remove(userId: string, id: string) {
  const existing = await findById(userId, id);
  if (existing.isSystem) {
    throw new Error('系统预置任务不可删除');
  }
  return prisma.cronJob.delete({ where: { id } });
}

// ═══ 初始化系统预置任务 ═══

export async function ensureSystemJobs(userId: string) {
  let created = 0;
  for (const job of SYSTEM_JOBS) {
    const existing = await prisma.cronJob.findFirst({
      where: { userId, name: job.name, isSystem: true },
    });
    if (!existing) {
      await prisma.cronJob.create({
        data: { ...job, userId, isSystem: true },
      });
      created++;
    }
  }
  return { created };
}
