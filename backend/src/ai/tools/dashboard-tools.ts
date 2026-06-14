import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const getDashboardSummaryTool: ToolDefinition = {
  name: 'get_dashboard_summary',
  description: `仪表盘汇总数据：项目数/任务数/客户数/本月收入/利润。

使用时机:
- "仪表盘"、"总览"、"概况"、"汇总数据"
- "整体情况怎么样"

不使用时机:
- 业务健康度 → 用 get_business_health
- 利润分析 → 用 get_profit_analysis

返回数据: projects/tasks/customers/finance/overview`,
  category: 'dashboard',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {},
  },
  handler: async (_args, userId) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [activeProjects, totalTasks, doneTasks, activeCustomers, incomeAgg, expenseAgg, overdueTasks] = await Promise.all([
      prisma.project.count({ where: { ownerId: userId, status: 'ACTIVE' } }),
      prisma.task.count({ where: { project: { ownerId: userId } } }),
      prisma.task.count({ where: { project: { ownerId: userId }, status: 'DONE' } }),
      prisma.customer.count({ where: { userId, status: { in: ['ACTIVE', 'VIP'] } } }),
      prisma.transaction.aggregate({ where: { userId, direction: 'INCOME', date: { gte: monthStart, lt: monthEnd } }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { userId, direction: 'EXPENSE', date: { gte: monthStart, lt: monthEnd } }, _sum: { amount: true } }),
      prisma.task.count({ where: { project: { ownerId: userId }, status: { notIn: ['DONE'] }, dueDate: { lt: now } } }),
    ]);

    const monthIncome = (incomeAgg._sum.amount || 0) / 100;
    const monthExpense = (expenseAgg._sum.amount || 0) / 100;
    const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    return {
      meta: { tool: 'get_dashboard_summary' },
      highlights: {
        activeProjects,
        totalTasks,
        completionRate: `${completionRate}%`,
        overdueTasks,
        activeCustomers,
        monthIncome,
        monthExpense,
      },
      summary: `${activeProjects} 个进行中项目，${totalTasks} 个任务（${completionRate}% 完成），${overdueTasks} 个逾期，本月收入 ¥${monthIncome}`,
      data: {
        projects: { active: activeProjects },
        tasks: { total: totalTasks, done: doneTasks, completionRate: `${completionRate}%`, overdue: overdueTasks },
        customers: { active: activeCustomers },
        finance: { monthIncome, monthExpense, monthProfit: monthIncome - monthExpense },
      },
    };
  },
};

export const getRecentActivityTool: ToolDefinition = {
  name: 'get_recent_activity',
  description: `最近活动：最近创建/完成的任务，最近的沟通记录。

使用时机:
- "最近做了什么"、"最近活动"、"最近有什么变化"

不使用时机:
- 今日焦点 → 用 get_today_focus
- 周报 → 用 get_weekly_review

返回数据: recentTasks/recentCommunications/period`,
  category: 'dashboard',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      days: { type: 'number', description: '最近N天，默认 7' },
    },
  },
  handler: async (args, userId) => {
    const days = (args.days as number) || 7;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [recentTasks, recentComms] = await Promise.all([
      prisma.task.findMany({
        where: { project: { ownerId: userId }, updatedAt: { gte: since } },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        include: { project: { select: { name: true } } },
      }),
      prisma.communication.findMany({
        where: { userId, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { customer: { select: { name: true } } },
      }),
    ]);

    const statusLabel: Record<string, string> = { TODO: '待办', IN_PROGRESS: '进行中', DONE: '已完成', BLOCKED: '阻塞' };

    return {
      meta: { tool: 'get_recent_activity', period: `最近 ${days} 天` },
      highlights: { taskUpdates: recentTasks.length, communications: recentComms.length },
      summary: `最近 ${days} 天：${recentTasks.length} 个任务更新，${recentComms.length} 条沟通记录`,
      data: {
        recentTasks: recentTasks.map(t => ({
          title: t.title,
          status: statusLabel[t.status] || t.status,
          project: t.project.name,
          updatedAt: t.updatedAt.toISOString().split('T')[0],
        })),
        recentCommunications: recentComms.map(c => ({
          type: c.type,
          customer: c.customer?.name || '-',
          summary: c.summary || c.content.slice(0, 50),
          date: c.createdAt.toISOString().split('T')[0],
        })),
      },
    };
  },
};
