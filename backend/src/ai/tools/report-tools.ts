import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const getReportOverviewTool: ToolDefinition = {
  name: 'get_report_overview',
  description: `报表总览：收入/支出/利润/利润率。支持按月/年筛选。

使用时机:
- "报表"、"报告"、"财务报表"
- "今年收入多少"、"本月利润"

不使用时机:
- 现金流 → 用 get_cash_flow
- 利润分析（按项目） → 用 get_profit_analysis

返回数据: income/expense/profit/profitRate/period`,
  category: 'report',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      month: { type: 'string', description: '筛选月份 YYYY-MM' },
      year: { type: 'string', description: '筛选年份 YYYY' },
    },
  },
  handler: async (args, userId) => {
    let start: Date, end: Date;
    if (args.month) {
      start = new Date((args.month as string) + '-01');
      end = new Date(start);
      end.setMonth(end.getMonth() + 1);
    } else if (args.year) {
      start = new Date(`${args.year}-01-01`);
      end = new Date(`${Number(args.year) + 1}-01-01`);
    } else {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    const dateFilter = { gte: start, lt: end };

    const [incomeAgg, expenseAgg, projectAgg] = await Promise.all([
      prisma.transaction.aggregate({ where: { userId, direction: 'INCOME', date: dateFilter }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { userId, direction: 'EXPENSE', date: dateFilter }, _sum: { amount: true } }),
      prisma.costRecord.aggregate({ where: { project: { ownerId: userId }, date: dateFilter }, _sum: { amount: true } }),
    ]);

    const income = (incomeAgg._sum.amount || 0) / 100;
    const expense = ((expenseAgg._sum.amount || 0) + (projectAgg._sum.amount || 0)) / 100;
    const profit = income - expense;
    const profitRate = income > 0 ? Math.round((profit / income) * 100) : 0;

    const period = args.month || args.year || `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;

    return {
      meta: { tool: 'get_report_overview', period },
      highlights: { income, expense, profit, profitRate: `${profitRate}%` },
      summary: `${period} 报表：收入 ¥${income}，支出 ¥${expense}，利润 ¥${profit}，利润率 ${profitRate}%`,
      data: { income, expense, profit, profitRate: `${profitRate}%`, period },
    };
  },
};

export const getProjectRankingTool: ToolDefinition = {
  name: 'get_project_ranking',
  description: `项目利润排名。按利润率或利润额排序。

使用时机:
- "项目排名"、"哪个项目最赚钱"、"利润排名"

不使用时机:
- 利润分析详情 → 用 get_profit_analysis
- 客户收入排名 → 用 get_revenue_by_client

返回数据: 排名列表含 project/profit/margin/budget/cost`,
  category: 'report',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      sortBy: { type: 'string', enum: ['profit', 'margin'], description: '排序方式：profit=利润额，margin=利润率' },
      limit: { type: 'number', description: '返回数量，默认 10' },
    },
  },
  handler: async (args, userId) => {
    const projects = await prisma.project.findMany({
      where: { ownerId: userId, status: { in: ['ACTIVE', 'COMPLETED'] } },
      include: { customer: { select: { name: true } } },
    });

    const projectIds = projects.map(p => p.id);
    const [costAggs, taskAggs] = await Promise.all([
      projectIds.length > 0 ? prisma.costRecord.groupBy({ by: ['projectId'], where: { projectId: { in: projectIds } }, _sum: { amount: true } }) : [],
      projectIds.length > 0 ? prisma.task.groupBy({ by: ['projectId'], where: { projectId: { in: projectIds }, cost: { gt: 0 } }, _sum: { cost: true } }) : [],
    ]);
    const costMap = new Map(costAggs.map(a => [a.projectId, a._sum.amount || 0]));
    const taskCostMap = new Map(taskAggs.map(a => [a.projectId, a._sum.cost || 0]));

    const limit = (args.limit as number) || 10;
    const ranked = projects
      .map(p => {
        const budget = (p.budget || 0) / 100;
        const cost = ((costMap.get(p.id) || 0) + (taskCostMap.get(p.id) || 0)) / 100;
        const profit = budget - cost;
        const margin = budget > 0 ? Math.round((profit / budget) * 100) : 0;
        return { project: p.name, customer: p.customer?.name || '', budget, cost, profit, margin: `${margin}%` };
      })
      .sort((a, b) => args.sortBy === 'margin' ? parseInt(b.margin) - parseInt(a.margin) : b.profit - a.profit)
      .slice(0, limit);

    return {
      meta: { tool: 'get_project_ranking', sortedBy: args.sortBy || 'profit', total: ranked.length },
      highlights: { topProject: ranked[0]?.project || '-' },
      summary: `${ranked.length} 个项目排名（按${args.sortBy === 'margin' ? '利润率' : '利润额'}排序），榜首「${ranked[0]?.project || '-'}」`,
      data: ranked.map((r, i) => ({ rank: i + 1, ...r })),
    };
  },
};

export const getCostStructureTool: ToolDefinition = {
  name: 'get_cost_structure',
  description: `成本结构分析：按类别（人工/材料/管理/其他）和项目分布。

使用时机:
- "成本结构"、"钱花在哪了"、"成本分布"
- "成本分析"

不使用时机:
- 成本明细 → 用 get_cost_breakdown
- 利润分析 → 用 get_profit_analysis

返回数据: byCategory(top3)/byProject(top5)/totalCost`,
  category: 'report',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {},
  },
  handler: async (_args, userId) => {
    const userProjects = await prisma.project.findMany({ where: { ownerId: userId }, select: { id: true, name: true } });
    const projectIds = userProjects.map(p => p.id);
    const nameMap = new Map(userProjects.map(p => [p.id, p.name]));

    if (projectIds.length === 0) {
      return { meta: { tool: 'get_cost_structure' }, highlights: { totalCost: 0 }, summary: '暂无成本数据', data: { byCategory: [], byProject: [], totalCost: 0 } };
    }

    const [byCategory, byProject] = await Promise.all([
      prisma.costRecord.groupBy({ by: ['category'], where: { projectId: { in: projectIds } }, _sum: { amount: true } }),
      prisma.costRecord.groupBy({ by: ['projectId'], where: { projectId: { in: projectIds } }, _sum: { amount: true } }),
    ]);

    const categoryLabel: Record<string, string> = { LABOR: '人工', MATERIAL: '材料', OVERHEAD: '管理', OTHER: '其他' };
    const totalCost = byCategory.reduce((s, c) => s + (c._sum.amount || 0), 0);

    return {
      meta: { tool: 'get_cost_structure' },
      highlights: { totalCost: totalCost / 100 },
      summary: `总成本 ¥${(totalCost / 100).toFixed(2)}，${byCategory.length} 个类别`,
      data: {
        totalCost: totalCost / 100,
        byCategory: byCategory
          .map(c => ({
            category: categoryLabel[c.category] || c.category,
            amount: (c._sum.amount || 0) / 100,
            percent: totalCost > 0 ? `${Math.round(((c._sum.amount || 0) / totalCost) * 100)}%` : '0%',
          }))
          .sort((a, b) => b.amount - a.amount),
        byProject: byProject
          .map(p => ({
            project: nameMap.get(p.projectId) || p.projectId,
            amount: (p._sum.amount || 0) / 100,
          }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5),
      },
    };
  },
};

export const getTimeAnalysisTool: ToolDefinition = {
  name: 'get_time_analysis',
  description: `工时分析：按项目/按日统计工时，估算 vs 实际对比。

使用时机:
- "工时分析"、"时间分析"、"工时统计"
- "哪个项目花时间最多"

不使用时机:
- 今日工时 → 用 get_today_entries
- 记录工时 → 用 log_time

返回数据: totalHours/byProject(top5)/recentDays`,
  category: 'report',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      days: { type: 'number', description: '统计最近N天，默认 30' },
    },
  },
  handler: async (args, userId) => {
    const days = (args.days as number) || 30;
    const start = new Date();
    start.setDate(start.getDate() - days);

    const entries = await prisma.timeEntry.findMany({
      where: { userId, date: { gte: start } },
      include: { project: { select: { name: true } } },
    });

    const totalHours = entries.reduce((s, e) => s + e.hours, 0);

    // 按项目聚合
    const byProject = new Map<string, number>();
    for (const e of entries) {
      const name = e.project?.name || '未关联';
      byProject.set(name, (byProject.get(name) || 0) + e.hours);
    }

    // 按日聚合
    const byDay = new Map<string, number>();
    for (const e of entries) {
      const day = e.date.toISOString().split('T')[0];
      byDay.set(day, (byDay.get(day) || 0) + e.hours);
    }

    const avgDaily = byDay.size > 0 ? Math.round((totalHours / byDay.size) * 10) / 10 : 0;

    return {
      meta: { tool: 'get_time_analysis', period: `最近 ${days} 天` },
      highlights: { totalHours, avgDaily, entryCount: entries.length },
      summary: `最近 ${days} 天记录 ${totalHours}h，日均 ${avgDaily}h`,
      data: {
        totalHours,
        avgDaily,
        byProject: [...byProject.entries()]
          .map(([project, hours]) => ({ project, hours: Math.round(hours * 10) / 10 }))
          .sort((a, b) => b.hours - a.hours)
          .slice(0, 5),
        recentDays: [...byDay.entries()]
          .sort((a, b) => b[0].localeCompare(a[0]))
          .slice(0, 7)
          .map(([date, hours]) => ({ date, hours: Math.round(hours * 10) / 10 })),
      },
    };
  },
};
