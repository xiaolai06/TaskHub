import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const listProjectsTool: ToolDefinition = {
  name: 'list_projects',
  description: `项目列表，支持状态筛选，含预算/成本/利润概览。

使用时机:
- "查看所有项目"、"项目列表"、"进行中的项目"
- "有哪些订单"、"项目概览"

不使用时机:
- 项目详情（含任务/成本/客户） → 用 get_project_detail
- 项目进度 → 用 get_project_progress
- 创建项目 → 用 create_project

返回数据: 项目列表含 name/status/budget/cost/profit/customerName/taskCount`,
  category: 'work',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['ACTIVE', 'COMPLETED', 'ARCHIVED'], description: '筛选状态' },
      limit: { type: 'number', description: '返回条数，默认 20' },
    },
  },
  handler: async (args, userId) => {
    const where: Record<string, unknown> = { ownerId: userId };
    if (args.status) where.status = args.status;

    const limit = (args.limit as number) || 20;
    const projects = await prisma.project.findMany({
      where,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        customer: { select: { name: true } },
        _count: { select: { tasks: true, costRecords: true } },
      },
    });

    const projectIds = projects.map(p => p.id);
    const costAggs = projectIds.length > 0
      ? await prisma.costRecord.groupBy({ by: ['projectId'], where: { projectId: { in: projectIds } }, _sum: { amount: true } })
      : [];
    const costMap = new Map(costAggs.map(a => [a.projectId, a._sum.amount || 0]));

    const data = projects.map(p => {
      const budget = p.budget || 0;
      const cost = costMap.get(p.id) || 0;
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        customer: p.customer?.name || '未关联',
        budget: budget / 100,
        cost: cost / 100,
        profit: (budget - cost) / 100,
        taskCount: p._count.tasks,
        startDate: p.startDate.toISOString().split('T')[0],
        endDate: p.endDate?.toISOString().split('T')[0] || null,
      };
    });

    const statusLabel: Record<string, string> = { ACTIVE: '进行中', COMPLETED: '已完成', ARCHIVED: '已归档' };
    const activeCount = data.filter(p => p.status === 'ACTIVE').length;

    return {
      meta: { tool: 'list_projects', total: data.length, statusFilter: args.status || '全部' },
      highlights: { activeCount, totalBudget: data.reduce((s, p) => s + p.budget, 0), totalProfit: data.reduce((s, p) => s + p.profit, 0) },
      summary: `${data.length} 个项目（${activeCount} 个进行中），总预算 ¥${data.reduce((s, p) => s + p.budget, 0).toLocaleString()}`,
      data: data.map(p => ({ ...p, status: statusLabel[p.status] || p.status })),
    };
  },
};

export const getProjectDetailTool: ToolDefinition = {
  name: 'get_project_detail',
  description: `项目详情：含任务列表、成本汇总、客户信息、工时统计。

使用时机:
- "XX项目详情"、"看看XX项目的情况"
- "XX项目的任务"、"XX项目的成本"

不使用时机:
- 项目列表 → 用 list_projects
- 项目利润 → 用 get_profit_analysis

返回数据: project/tasks/costs/customer/timeEntries`,
  category: 'work',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: '项目 ID' },
      projectName: { type: 'string', description: '项目名，模糊匹配' },
    },
  },
  handler: async (args, userId) => {
    let projectId = args.projectId as string | undefined;
    if (!projectId && args.projectName) {
      const project = await prisma.project.findFirst({ where: { ownerId: userId, name: { contains: args.projectName as string } } });
      if (project) projectId = project.id;
    }
    if (!projectId) return { error: '请指定项目' };

    const project = await prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
      include: {
        customer: { select: { id: true, name: true, company: true, email: true } },
        tasks: {
          orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
          select: { id: true, title: true, status: true, priority: true, estimatedHours: true, actualHours: true, dueDate: true },
        },
      },
    });
    if (!project) return { error: '项目不存在或无权访问' };

    const [costAgg, timeAgg] = await Promise.all([
      prisma.costRecord.aggregate({ where: { projectId }, _sum: { amount: true }, _count: true }),
      prisma.timeEntry.aggregate({ where: { projectId, userId }, _sum: { hours: true }, _count: true }),
    ]);

    const budget = project.budget || 0;
    const totalCost = costAgg._sum.amount || 0;
    const totalHours = timeAgg._sum.hours || 0;
    const statusLabel: Record<string, string> = { ACTIVE: '进行中', COMPLETED: '已完成', ARCHIVED: '已归档' };

    return {
      meta: { tool: 'get_project_detail' },
      highlights: {
        status: statusLabel[project.status] || project.status,
        budget: budget / 100,
        totalCost: totalCost / 100,
        profit: (budget - totalCost) / 100,
        totalHours,
        taskCount: project.tasks.length,
      },
      summary: `「${project.name}」${statusLabel[project.status] || project.status}，预算 ¥${budget / 100}，成本 ¥${totalCost / 100}，${project.tasks.length} 个任务`,
      data: {
        project: {
          id: project.id,
          name: project.name,
          status: project.status,
          type: project.type,
          budget: budget / 100,
          startDate: project.startDate.toISOString().split('T')[0],
          endDate: project.endDate?.toISOString().split('T')[0] || null,
        },
        customer: project.customer,
        tasks: project.tasks.map(t => ({
          title: t.title,
          status: t.status,
          priority: t.priority,
          estimatedHours: t.estimatedHours,
          dueDate: t.dueDate?.toISOString().split('T')[0] || null,
        })),
        costSummary: { total: totalCost / 100, count: costAgg._count },
        timeSummary: { totalHours, count: timeAgg._count },
      },
    };
  },
};

export const archiveProjectTool: ToolDefinition = {
  name: 'archive_project',
  description: '归档已完成的项目。用户说"归档XX项目""这个项目可以归档了"时调用。写操作需确认。',
  category: 'work',
  access: 'write',
  requiresConfirmation: true,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: '项目 ID' },
      projectName: { type: 'string', description: '项目名，模糊匹配' },
    },
  },
  handler: async (args, userId) => {
    let projectId = args.projectId as string | undefined;
    if (!projectId && args.projectName) {
      const project = await prisma.project.findFirst({ where: { ownerId: userId, name: { contains: args.projectName as string } } });
      if (project) projectId = project.id;
    }
    if (!projectId) return { error: '请指定项目' };

    const project = await prisma.project.findFirst({ where: { id: projectId, ownerId: userId } });
    if (!project) return { error: '项目不存在或无权访问' };
    if (project.status === 'ARCHIVED') return { error: '项目已经归档了' };

    await prisma.project.update({ where: { id: projectId }, data: { status: 'ARCHIVED' } });
    return {
      success: true,
      action: '归档项目',
      summary: `已归档项目「${project.name}」`,
      details: { 项目: project.name, 状态: '已归档' },
    };
  },
};
