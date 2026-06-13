import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const getProfitAnalysisTool: ToolDefinition = {
  name: 'get_profit_analysis',
  description: `分析订单利润：对比每单报价 vs 实际成本（含材料费+任务成本），计算利润率，标注盈亏。支持按月筛选。

使用时机:
- “赚了多少”、”利润”、”盈亏”、”哪个订单不划算”
- “利润率多少”、”哪个项目亏了”、”项目赚钱吗”

不使用时机:
- 查看现金流/收支 → 用 get_cash_flow
- 查看成本明细 → 用 get_cost_breakdown
- 查看客户收入排名 → 用 get_revenue_by_client
- 项目进度查询 → 用 get_project_progress

返回数据: 项目列表含 quote(报价)/cost(成本)/profit(利润)/margin(利润率)，按利润降序`,
  category: 'finance',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: '项目/订单 ID，不传则分析所有进行中订单' },
      month: { type: 'string', description: '筛选月份 YYYY-MM，默认不筛选' },
    },
  },
  handler: async (args, userId) => {
    const m = args.month as string | undefined;
    const start = m ? new Date(m + '-01') : null;
    const end = start ? new Date(start) : null;
    if (end) end.setMonth(end.getMonth() + 1);

    const where: Record<string, unknown> = { ownerId: userId, status: 'ACTIVE' };
    if (args.projectId) where.id = args.projectId;
    const projects = await prisma.project.findMany({ where, include: { customer: { select: { name: true } } } });
    const projectIds = projects.map(p => p.id);

    // 批量聚合替代 N+1 查询，支持按月筛选
    const costWhere: Record<string, unknown> = { projectId: { in: projectIds } };
    const taskWhere: Record<string, unknown> = { projectId: { in: projectIds }, cost: { gt: 0 } };
    if (start && end) {
      costWhere.date = { gte: start, lt: end };
      taskWhere.completedAt = { gte: start, lt: end };
    }

    const [costAggs, taskAggs] = await Promise.all([
      projectIds.length > 0 ? prisma.costRecord.groupBy({ by: ['projectId'], where: costWhere, _sum: { amount: true } }) : [],
      projectIds.length > 0 ? prisma.task.groupBy({ by: ['projectId'], where: taskWhere, _sum: { cost: true } }) : [],
    ]);
    const costMap = new Map(costAggs.map(a => [a.projectId, a._sum.amount || 0]));
    const taskCostMap = new Map(taskAggs.map(a => [a.projectId, a._sum.cost || 0]));

    const data = projects.map(project => {
      const cost = (costMap.get(project.id) || 0) + (taskCostMap.get(project.id) || 0);
      const quote = project.budget || 0;
      const profit = quote - cost;
      return {
        projectName: project.name,
        customer: project.customer?.name || '未关联客户',
        quote: quote / 100, cost: cost / 100, profit: profit / 100,
        margin: quote > 0 ? `${Math.round((profit / quote) * 100)}%` : '-',
        status: profit > 0 ? '盈利' : profit < 0 ? '亏损' : '持平',
      };
    }).sort((a, b) => b.profit - a.profit);

    const totalProfit = data.reduce((s, p) => s + p.profit, 0);
    const best = data[0];
    const worst = data[data.length - 1];
    const avgMargin = data.length > 0 ? Math.round(data.reduce((s, p) => {
      const m = parseFloat(p.margin); return s + (isNaN(m) ? 0 : m);
    }, 0) / data.length) : 0;
    const hasAnomaly = data.some(p => p.status === '亏损');

    return {
      meta: {
        tool: 'get_profit_analysis',
        timeRange: m || '全量',
        totalInDB: projects.length,
        returned: data.length,
        hasAnomaly,
        anomalyNote: hasAnomaly ? `存在${data.filter(p => p.status === '亏损').length}个亏损项目` : undefined,
      },
      highlights: {
        totalProfit: Math.round(totalProfit * 100) / 100,
        bestProject: best ? `${best.projectName} (¥${best.profit})` : '-',
        worstProject: worst ? `${worst.projectName} (¥${worst.profit})` : '-',
        projectCount: data.length,
        avgMargin: `${avgMargin}%`,
      },
      summary: `${m ? m + '月' : '全部'}${data.length}个项目，总利润¥${Math.round(totalProfit)}，平均利润率${avgMargin}%${hasAnomaly ? '，存在亏损项目' : ''}`,
      data,
    };
  },
};