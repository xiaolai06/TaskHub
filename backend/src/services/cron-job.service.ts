import { prisma } from '../server';
import { NotFoundError } from '../utils/errors';
import type { CreateCronJobInput, UpdateCronJobInput } from '../validators/cron-job.schema';

function parseCfg(s: string): Record<string, unknown> {
  try { return JSON.parse(s); } catch { return {}; }
}

export const SYSTEM_JOBS = [
  {
    name: '晨间简报',
    cronExpr: '0 8 * * *',
    action: 'AI_ANALYSIS',
    config: JSON.stringify({
      type: 'morning',
      description: '每日早间分析项目、任务和客户数据，生成行动建议（含到期提醒）',
      aiPrompt: 'system-morning.txt',
      dataQueries: ['getStats', 'detectDelays', 'recentConversations'],
    }),
  },
  {
    name: '客户雷达',
    cronExpr: '30 8 * * *',
    action: 'AI_ANALYSIS',
    config: JSON.stringify({
      type: 'client_radar',
      description: '扫描客户沟通间隔，提示需要跟进的客户',
      aiPrompt: 'system-client-radar.txt',
      dataQueries: ['customerList', 'communications', 'projectStatus'],
    }),
  },
  {
    name: '成本预警',
    cronExpr: '0 9 * * *',
    action: 'NOTIFY',
    config: JSON.stringify({
      type: 'cost_alert',
      description: '检查订单成本是否超过报价的 80%，发送预警通知',
      dataQueries: ['costSummary'],
    }),
  },
  {
    name: '订单利润简报',
    cronExpr: '30 9 * * *',
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

/**
 * 确保系统预置任务存在且配置正确
 * - 清理重复：同名系统任务只保留最早的
 * - 清理废弃：不在 SYSTEM_JOBS 列表中的系统任务删除
 * - 强制同步：每次都更新 cronExpr + config，确保与代码一致
 */
export async function ensureSystemJobs(userId: string) {
  let created = 0;
  let updated = 0;
  let removed = 0;

  const validNames = SYSTEM_JOBS.map(j => j.name);

  // 1. 删除废弃的系统任务（如旧的"到期提醒"、重复的条目）
  const allSystem = await prisma.cronJob.findMany({
    where: { userId, isSystem: true },
    orderBy: { createdAt: 'asc' },
  });

  for (const job of allSystem) {
    if (!validNames.includes(job.name)) {
      await prisma.cronJob.delete({ where: { id: job.id } });
      removed++;
    }
  }

  // 2. 对每个预置任务：去重 + 强制同步
  for (const job of SYSTEM_JOBS) {
    const existing = await prisma.cronJob.findMany({
      where: { userId, name: job.name, isSystem: true },
      orderBy: { createdAt: 'asc' },
    });

    if (existing.length === 0) {
      // 不存在 → 创建
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
    } else {
      // 存在 → 保留第一条，删除多余
      const keep = existing[0];
      if (existing.length > 1) {
        await prisma.cronJob.deleteMany({
          where: { id: { in: existing.slice(1).map(j => j.id) } },
        });
        removed += existing.length - 1;
      }
      // 同步系统字段，但保留用户自定义的通知配置
      const oldCfg = parseCfg(keep.config);
      const newCfg = parseCfg(job.config);
      const merged = JSON.stringify({
        ...newCfg,
        // 保留用户配置的通知渠道
        emailEnabled: oldCfg.emailEnabled ?? false,
        webhookTargets: Array.isArray(oldCfg.webhookTargets) ? oldCfg.webhookTargets : [],
        // 保留用户配置的 AI 模型
        ...(keep.aiModel ? {} : {}),
      });
      await prisma.cronJob.update({
        where: { id: keep.id },
        data: { cronExpr: job.cronExpr, config: merged },
      });
      updated++;
    }
  }

  return { created, updated, removed };
}
