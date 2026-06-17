import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const getTodayFocusTool: ToolDefinition = {
  name: 'get_today_focus',
  description: `获取今日工作焦点：按优先级排序的待办任务，标注延期/到期/阻塞状态。

使用时机:
- "今天做什么"、"有什么任务"、"先做哪个"
- "今日工作安排"、"今天有哪些待办"

不使用时机:
- 只关心延期任务 → 用 get_overdue_tasks
- 查看某个项目的具体进度 → 用 get_project_progress
- 查看排期安排 → 用 get_schedule
- 创建/修改任务 → 用 create_task / update_task_status

返回数据: 优先级排序的任务列表，含 overdue/blocked/due_today 标记`,
  category: 'work', access: 'read', requiresConfirmation: false, preferredModel: 'fast',
  parameters: { type: 'object', properties: { topN: { type: 'number', description: '返回前N个，默认5' } } },
  handler: async (args, userId) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tasks = await prisma.task.findMany({ where: { project: { ownerId: userId }, status: { in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] } }, include: { project: { select: { name: true } } }, orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }], take: (args.topN as number) || 5 });
    const data = tasks.map(t => ({ title: t.title, priority: t.priority, project: t.project.name, dueDate: t.dueDate ? t.dueDate.toISOString().split('T')[0] : null, status: t.status, estimatedHours: t.estimatedHours, flag: t.dueDate && t.dueDate < today ? 'OVERDUE' : t.dueDate && t.dueDate.getTime() === today.getTime() ? 'DUE_TODAY' : t.status === 'BLOCKED' ? 'BLOCKED' : null }));
    return {
      meta: { tool: 'get_today_focus', timeRange: '今天', date: today.toISOString().split('T')[0] },
      highlights: { urgentCount: data.filter(d => d.flag === 'OVERDUE').length, blockedCount: data.filter(d => d.flag === 'BLOCKED').length, totalToday: data.length },
      summary: `今日${data.length}个待办${data.filter(d => d.flag === 'OVERDUE').length > 0 ? `，${data.filter(d => d.flag === 'OVERDUE').length}个已延期` : ''}${data.filter(d => d.flag === 'BLOCKED').length > 0 ? `，${data.filter(d => d.flag === 'BLOCKED').length}个被阻塞` : ''}`,
      data,
    };
  },
};

export const getOverdueTasksTool: ToolDefinition = {
  name: 'get_overdue_tasks',
  description: `获取所有延期任务：已过截止日期但未完成的任务，含延期天数和涉及项目数。

使用时机:
- "有什么延期"、"哪些任务过期了"、"延期任务"
- "哪些任务拖了很久"、"有什么风险"

不使用时机:
- 查看今日全部待办（含正常任务） → 用 get_today_focus
- 查看某个项目的进度 → 用 get_project_progress
- 任务排期冲突分析 → 用 suggest_rebalance

返回数据: 延期任务列表，含 overdueDays（延期天数）和 affectedProjects（涉及项目数）`,
  category: 'work', access: 'read', requiresConfirmation: false, preferredModel: 'fast',
  parameters: { type: 'object', properties: {} },
  handler: async (_args, userId) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tasks = await prisma.task.findMany({ where: { project: { ownerId: userId }, status: { notIn: ['DONE'] }, dueDate: { lt: today } }, include: { project: { select: { name: true } } }, orderBy: { dueDate: 'asc' } });
    const data = tasks.map(t => ({ title: t.title, priority: t.priority, project: t.project.name, dueDate: t.dueDate?.toISOString().split('T')[0], overdueDays: t.dueDate ? Math.ceil((today.getTime() - t.dueDate.getTime()) / 86400000) : 0, status: t.status }));
    const mostOverdue = data.length > 0 ? data.reduce((max, t) => t.overdueDays > max.overdueDays ? t : max) : null;
    const affectedProjects = new Set(data.map(t => t.project)).size;
    return {
      meta: { tool: 'get_overdue_tasks', timeRange: '截至今天', date: today.toISOString().split('T')[0] },
      highlights: { overdueCount: data.length, mostOverdue: mostOverdue ? `${mostOverdue.title} (${mostOverdue.overdueDays}天)` : '-', affectedProjects },
      summary: `${data.length}个延期任务，涉及${affectedProjects}个项目${mostOverdue ? `，最久延期${mostOverdue.overdueDays}天` : ''}`,
      data,
    };
  },
};

export const getProjectProgressTool: ToolDefinition = {
  name: 'get_project_progress',
  description: `查询指定项目的完成进度：任务总数、已完成、进行中、阻塞数和完成百分比。

使用时机:
- "XX项目完成多少了"、"XX进度怎么样"
- "这个项目还有多少没做"、"项目进展"

不使用时机:
- 查看今日所有待办任务 → 用 get_today_focus
- 查看延期任务 → 用 get_overdue_tasks
- 分析项目利润 → 用 get_profit_analysis
- 项目排期建议 → 用 get_schedule_advice

返回数据: 项目名、状态、任务统计（done/inProgress/blocked/total）、完成百分比`,
  category: 'work', access: 'read', requiresConfirmation: false, preferredModel: 'fast',
  parameters: { type: 'object', properties: { projectId: { type: 'string', description: '项目 ID' }, projectName: { type: 'string', description: '项目名模糊匹配' } }, required: [] },
  handler: async (args, userId) => {
    let project;
    if (args.projectId) project = await prisma.project.findFirst({ where: { id: args.projectId as string, ownerId: userId } });
    else if (args.projectName) project = await prisma.project.findFirst({ where: { ownerId: userId, name: { contains: args.projectName as string } } });
    if (!project) return { error: '未找到项目' };
    const tasks = await prisma.task.findMany({ where: { projectId: project.id } });
    const done = tasks.filter(t => t.status === 'DONE').length;
    const total = tasks.length;
    return {
      meta: { tool: 'get_project_progress', timeRange: '当前' },
      highlights: { completed: done, inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length, blocked: tasks.filter(t => t.status === 'BLOCKED').length, totalTasks: total, percent: total > 0 ? Math.round((done / total) * 100) + '%' : '0%' },
      summary: `${project.name} 进度${total > 0 ? Math.round((done / total) * 100) : 0}%，${done}/${total}完成${tasks.filter(t => t.status === 'BLOCKED').length > 0 ? `，${tasks.filter(t => t.status === 'BLOCKED').length}个阻塞` : ''}`,
      data: { projectName: project.name, status: project.status, total, done, inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length, blocked: tasks.filter(t => t.status === 'BLOCKED').length, percent: total > 0 ? Math.round((done / total) * 100) + '%' : '0%' },
    };
  },
};
