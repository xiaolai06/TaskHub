import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const getGoalProgressTool: ToolDefinition = {
  name: 'get_goal_progress',
  description: `查询目标完成进度：当前值 vs 目标值，计算完成百分比，含里程碑列表。支持按类型和月份筛选。

使用时机:
- "目标完成"、"进度怎么样"、"目标进展"
- "月度目标完成了吗"、"季度目标"

不使用时机:
- 查看本周工作总结 → 用 get_weekly_review
- 生成下周计划 → 用 suggest_weekly_plan
- 查看业务整体健康度 → 用 get_business_health

返回数据: 目标列表含 target/current/percent/milestones，支持 type(MONTHLY/QUARTERLY/YEARLY)+month 参数`, category: 'goal', access: 'read', requiresConfirmation: false, preferredModel: 'fast',
  parameters: { type: 'object', properties: { type: { type: 'string', enum: ['MONTHLY','QUARTERLY','YEARLY'] }, month: { type: 'string', description: '筛选月份 YYYY-MM，筛选时间段与目标有交集的目标' } } },
  handler: async (args, userId) => {
    const where: Record<string, unknown> = { userId, status: 'ACTIVE' };
    if (args.type) where.type = args.type;
    if (args.month) {
      const start = new Date((args.month as string) + '-01');
      const end = new Date(start); end.setMonth(end.getMonth() + 1);
      where.AND = [{ startDate: { lt: end } }, { endDate: { gte: start } }];
    }
    const goals = await prisma.goal.findMany({ where, include: { milestones: { orderBy: { sortOrder: 'asc' } } } });
    const data = goals.map(g => ({ title: g.title, type: g.type, metricType: g.metricType, target: g.targetValue, current: g.currentValue, unit: g.unit, percent: g.targetValue ? Math.round((g.currentValue / g.targetValue) * 100) + '%' : '-', endDate: g.endDate.toISOString().split('T')[0], milestones: g.milestones.slice(0, 3).map(m => ({ title: m.title, target: m.targetValue, completed: m.completed })) }));
    const avgProgress = goals.length > 0 ? Math.round(goals.reduce((s, g) => s + (g.targetValue ? (g.currentValue / g.targetValue) * 100 : 0), 0) / goals.length) : 0;
    return {
      meta: { tool: 'get_goal_progress', timeRange: args.month || '全量', totalInDB: goals.length, returned: data.length },
      highlights: { goalCount: data.length, avgProgress: `${avgProgress}%`, typeFilter: args.type || '全部' },
      summary: `${data.length}个${args.type ? args.type + '类' : ''}目标，平均进度${avgProgress}%`,
      data,
    };
  },
};

export const getWeeklyReviewTool: ToolDefinition = {
  name: 'get_weekly_review',
  description: `本周工作总结：已完成任务、记录工时、花费成本。支持指定周起始日期。

使用时机:
- "这周做了什么"、"周报"、"本周总结"
- "这周完成多少任务"、"本周工时"

不使用时机:
- 查看目标进度 → 用 get_goal_progress
- 生成下周计划 → 用 suggest_weekly_plan
- 查看今日待办 → 用 get_today_focus

返回数据: week/completedTasks/top5/totalHours/totalCost/taskCount，支持 weekStart 参数`, category: 'goal', access: 'read', requiresConfirmation: false, preferredModel: 'balanced',
  parameters: { type: 'object', properties: { weekStart: { type: 'string', description: '周一日期' } } },
  handler: async (args, userId) => {
    const now = new Date(); const mon = args.weekStart ? new Date(args.weekStart as string) : new Date(now.setDate(now.getDate() - now.getDay() + 1)); mon.setHours(0, 0, 0, 0); const sun = new Date(mon); sun.setDate(sun.getDate() + 7);
    const done = await prisma.task.findMany({ where: { project: { ownerId: userId }, status: 'DONE', completedAt: { gte: mon, lt: sun } }, include: { project: { select: { name: true } } } });
    const entries = await prisma.timeEntry.findMany({ where: { userId, date: { gte: mon, lt: sun } } });
    const costs = await prisma.costRecord.findMany({ where: { project: { ownerId: userId }, date: { gte: mon, lt: sun } } });
    return { week: `${mon.toISOString().split('T')[0]} ~ ${sun.toISOString().split('T')[0]}`, completedTasks: done.slice(0, 5).map(t => ({ title: t.title, project: t.project.name })), totalHours: entries.reduce((s, e) => s + e.hours, 0), totalCost: costs.reduce((s, c) => s + c.amount, 0) / 100, taskCount: done.length };
  },
};

export const suggestWeeklyPlanTool: ToolDefinition = {
  name: 'suggest_weekly_plan',
  description: `生成下周工作计划：列出未完成任务（按优先级），预览排期，给出建议。

使用时机:
- "安排下周"、"帮我排计划"、"下周做什么"
- "下周计划"、"工作安排"

不使用时机:
- 查看本周总结 → 用 get_weekly_review
- 查看今日待办 → 用 get_today_focus
- 查看排期冲突 → 用 suggest_rebalance
- 查看延期任务 → 用 get_overdue_tasks

返回数据: uncompletedTasks(按优先级)/schedulePreview(排期预览)/suggestion(建议文字)`, category: 'goal', access: 'read', requiresConfirmation: false, preferredModel: 'balanced',
  parameters: { type: 'object', properties: { weekStart: { type: 'string', description: '周一日期' } } },
  handler: async (args, userId) => {
    const tasks = await prisma.task.findMany({ where: { project: { ownerId: userId }, status: { in: ['TODO', 'IN_PROGRESS'] } }, include: { project: { select: { name: true } } }, orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }] });
    const activeProjects = await prisma.project.findMany({ where: { ownerId: userId, status: 'ACTIVE' }, select: { id: true } });
    let schedule = null;
    if (activeProjects.length > 0) { const { calculateSchedule } = await import('../../services/scheduler.service'); schedule = await calculateSchedule(userId, { projectId: activeProjects[0].id, dailyHourLimit: 8 }); }
    return { uncompletedTasks: tasks.slice(0, 10).map(t => ({ title: t.title, priority: t.priority, project: t.project.name, dueDate: t.dueDate?.toISOString().split('T')[0], estimatedHours: t.estimatedHours })), schedulePreview: schedule?.tasks.slice(0, 7), suggestion: `你有 ${tasks.length} 个未完成任务，建议按优先级处理` };
  },
};

export const getBusinessHealthTool: ToolDefinition = {
  name: 'get_business_health',
  description: `业务健康度综合评估：从财务、客户、项目、目标四个维度打分，给出整体健康度评级。支持按月筛选。

使用时机:
- "整体情况"、"业务健康度"、"综合评估"
- "公司运营怎么样"、"全面分析一下"

不使用时机:
- 只看利润 → 用 get_profit_analysis
- 只看客户 → 用 get_client_ranking
- 只看目标 → 用 get_goal_progress
- 只看项目进度 → 用 get_project_progress

返回数据: overall(健康/需关注/危险)/score/finance/clients/projects/goals/topConcerns，支持 month 参数`, category: 'goal', access: 'read', requiresConfirmation: false, preferredModel: 'balanced',
  parameters: { type: 'object', properties: { month: { type: 'string', description: '筛选月份 YYYY-MM，财务和任务按月统计，客户和目标保持全局' } } },
  handler: async (args, userId) => {
    const m = args.month as string | undefined;
    const start = m ? new Date(m + '-01') : null;
    const end = start ? new Date(start) : null;
    if (end) end.setMonth(end.getMonth() + 1);

    const activeProjects = await prisma.project.findMany({ where: { ownerId: userId, status: 'ACTIVE' } });
    const totalBudget = activeProjects.reduce((s, p) => s + (p.budget || 0), 0);

    // 成本支持按月筛选
    const costWhere: Record<string, unknown> = { project: { ownerId: userId } };
    if (start && end) costWhere.date = { gte: start, lt: end };
    const costAgg = await prisma.costRecord.aggregate({ where: costWhere, _sum: { amount: true } });
    const totalCost = costAgg._sum.amount || 0;

    const profitRate = totalBudget > 0 ? (totalBudget - totalCost) / totalBudget : 0;
    const activeClients = await prisma.customer.count({ where: { userId, status: { in: ['ACTIVE', 'VIP'] } } });

    // 任务支持按月筛选（完成/总数/延期）
    const taskBaseWhere: Record<string, unknown> = { project: { ownerId: userId } };
    const doneWhere: Record<string, unknown> = { ...taskBaseWhere, status: 'DONE' };
    const overdueWhere: Record<string, unknown> = { ...taskBaseWhere, status: { notIn: ['DONE'] }, dueDate: { lt: new Date() } };
    if (start && end) {
      doneWhere.completedAt = { gte: start, lt: end };
      overdueWhere.dueDate = start && end ? { gte: start, lt: end } : overdueWhere.dueDate;
    }
    const doneTasks = await prisma.task.count({ where: doneWhere });
    const totalTasks = await prisma.task.count({ where: taskBaseWhere });
    const overdueTasks = await prisma.task.count({ where: overdueWhere });

    const activeGoals = await prisma.goal.findMany({ where: { userId, status: 'ACTIVE' } });
    const goalProgress = activeGoals.length > 0 ? activeGoals.reduce((s, g) => s + (g.targetValue ? (g.currentValue / g.targetValue) : 0), 0) / activeGoals.length : 0;
    const fScore = profitRate > 0.3 ? 90 : profitRate > 0 ? 70 : 40;
    const cScore = activeClients >= 5 ? 90 : activeClients >= 2 ? 70 : 50;
    const pScore = overdueTasks === 0 ? 90 : overdueTasks <= 2 ? 70 : 40;
    const gScore = goalProgress > 0.8 ? 90 : goalProgress > 0.5 ? 70 : 40;
    const overall = Math.round((fScore + cScore + pScore + gScore) / 4);
    const scope = m ? `${m} 月度` : '全局';
    return {
      meta: { tool: 'get_business_health', timeRange: m || '全局', scope },
      highlights: { overallScore: overall, profitRate: `${Math.round(profitRate * 100)}%`, activeClients, overdueTasks, goalProgress: `${Math.round(goalProgress * 100)}%` },
      summary: `${scope}健康度${overall}分(${overall >= 80 ? '健康' : overall >= 60 ? '需关注' : '危险'})，利润率${Math.round(profitRate * 100)}%，${activeClients}个活跃客户，${overdueTasks}个延期任务`,
      data: { scope, overall: overall >= 80 ? '健康' : overall >= 60 ? '需关注' : '危险', score: overall, finance: { score: fScore, detail: `利润率 ${Math.round(profitRate * 100)}%` }, clients: { score: cScore, detail: `${activeClients} 个活跃客户` }, projects: { score: pScore, detail: `${doneTasks}/${totalTasks} 完成，${overdueTasks} 延期` }, goals: { score: gScore, detail: `平均进度 ${Math.round(goalProgress * 100)}%` }, topConcerns: [overdueTasks > 0 ? `${overdueTasks} 个任务延期` : null, profitRate < 0 ? '项目亏损' : null, activeClients < 2 ? '客户过少' : null].filter(Boolean) },
    };
  },
};
