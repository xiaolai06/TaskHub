import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const getGoalProgressTool: ToolDefinition = {
  name: 'get_goal_progress', description: '查询目标完成进度。当用户问"目标完成"、"进度怎么样"时调用。', category: 'goal', access: 'read', requiresConfirmation: false, preferredModel: 'fast',
  parameters: { type: 'object', properties: { type: { type: 'string', enum: ['MONTHLY','QUARTERLY','YEARLY'] } } },
  handler: async (args, userId) => {
    const where: Record<string, unknown> = { userId, status: 'ACTIVE' }; if (args.type) where.type = args.type;
    const goals = await prisma.goal.findMany({ where, include: { milestones: { orderBy: { sortOrder: 'asc' } } } });
    return goals.map(g => ({ title: g.title, type: g.type, metricType: g.metricType, target: g.targetValue, current: g.currentValue, unit: g.unit, percent: g.targetValue ? Math.round((g.currentValue / g.targetValue) * 100) + '%' : '-', endDate: g.endDate.toISOString().split('T')[0], milestones: g.milestones.slice(0, 3).map(m => ({ title: m.title, target: m.targetValue, completed: m.completed })) }));
  },
};

export const getWeeklyReviewTool: ToolDefinition = {
  name: 'get_weekly_review', description: '本周工作总结。当用户问"这周做了什么"、"周报"时调用。', category: 'goal', access: 'read', requiresConfirmation: false, preferredModel: 'balanced',
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
  name: 'suggest_weekly_plan', description: '生成下周工作计划。当用户说"安排下周"、"帮我排计划"时调用。', category: 'goal', access: 'read', requiresConfirmation: false, preferredModel: 'balanced',
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
  name: 'get_business_health', description: '业务健康度综合评估。当用户问"整体情况"、"业务健康度"时调用。', category: 'goal', access: 'read', requiresConfirmation: false, preferredModel: 'balanced',
  parameters: { type: 'object', properties: {} },
  handler: async (_args, userId) => {
    const activeProjects = await prisma.project.findMany({ where: { ownerId: userId, status: 'ACTIVE' } });
    const totalBudget = activeProjects.reduce((s, p) => s + (p.budget || 0), 0);
    const costAgg = await prisma.costRecord.aggregate({ where: { project: { ownerId: userId } }, _sum: { amount: true } }); const totalCost = costAgg._sum.amount || 0;
    const profitRate = totalBudget > 0 ? (totalBudget - totalCost) / totalBudget : 0;
    const activeClients = await prisma.customer.count({ where: { userId, status: { in: ['ACTIVE', 'VIP'] } } });
    const doneTasks = await prisma.task.count({ where: { project: { ownerId: userId }, status: 'DONE' } });
    const totalTasks = await prisma.task.count({ where: { project: { ownerId: userId } } });
    const overdueTasks = await prisma.task.count({ where: { project: { ownerId: userId }, status: { notIn: ['DONE'] }, dueDate: { lt: new Date() } } });
    const activeGoals = await prisma.goal.findMany({ where: { userId, status: 'ACTIVE' } });
    const goalProgress = activeGoals.length > 0 ? activeGoals.reduce((s, g) => s + (g.targetValue ? (g.currentValue / g.targetValue) : 0), 0) / activeGoals.length : 0;
    const fScore = profitRate > 0.3 ? 90 : profitRate > 0 ? 70 : 40;
    const cScore = activeClients >= 5 ? 90 : activeClients >= 2 ? 70 : 50;
    const pScore = overdueTasks === 0 ? 90 : overdueTasks <= 2 ? 70 : 40;
    const gScore = goalProgress > 0.8 ? 90 : goalProgress > 0.5 ? 70 : 40;
    const overall = Math.round((fScore + cScore + pScore + gScore) / 4);
    return { overall: overall >= 80 ? '健康' : overall >= 60 ? '需关注' : '危险', score: overall, finance: { score: fScore, detail: `利润率 ${Math.round(profitRate * 100)}%` }, clients: { score: cScore, detail: `${activeClients} 个活跃客户` }, projects: { score: pScore, detail: `${doneTasks}/${totalTasks} 完成，${overdueTasks} 延期` }, goals: { score: gScore, detail: `平均进度 ${Math.round(goalProgress * 100)}%` }, topConcerns: [overdueTasks > 0 ? `${overdueTasks} 个任务延期` : null, profitRate < 0 ? '项目亏损' : null, activeClients < 2 ? '客户过少' : null].filter(Boolean) };
  },
};
