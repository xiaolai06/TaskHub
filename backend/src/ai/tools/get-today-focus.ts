import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const getTodayFocusTool: ToolDefinition = {
  name: 'get_today_focus', description: '获取今日工作焦点。当用户问"今天做什么"、"有什么任务"、"先做哪个"时调用。',
  category: 'work', access: 'read', requiresConfirmation: false, preferredModel: 'fast',
  parameters: { type: 'object', properties: { topN: { type: 'number', description: '返回前N个，默认5' } } },
  handler: async (args, userId) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tasks = await prisma.task.findMany({ where: { project: { ownerId: userId }, status: { in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] } }, include: { project: { select: { name: true } } }, orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }], take: (args.topN as number) || 5 });
    return tasks.map(t => ({ title: t.title, priority: t.priority, project: t.project.name, dueDate: t.dueDate ? t.dueDate.toISOString().split('T')[0] : null, status: t.status, estimatedHours: t.estimatedHours, flag: t.dueDate && t.dueDate < today ? 'OVERDUE' : t.dueDate && t.dueDate.getTime() === today.getTime() ? 'DUE_TODAY' : t.status === 'BLOCKED' ? 'BLOCKED' : null }));
  },
};

export const getOverdueTasksTool: ToolDefinition = {
  name: 'get_overdue_tasks', description: '获取延期任务。当用户问"有什么延期"、"哪些任务过期了"时调用。',
  category: 'work', access: 'read', requiresConfirmation: false, preferredModel: 'fast',
  parameters: { type: 'object', properties: {} },
  handler: async (_args, userId) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tasks = await prisma.task.findMany({ where: { project: { ownerId: userId }, status: { notIn: ['DONE'] }, dueDate: { lt: today } }, include: { project: { select: { name: true } } }, orderBy: { dueDate: 'asc' } });
    return tasks.map(t => ({ title: t.title, priority: t.priority, project: t.project.name, dueDate: t.dueDate?.toISOString().split('T')[0], overdueDays: t.dueDate ? Math.ceil((today.getTime() - t.dueDate.getTime()) / 86400000) : 0, status: t.status }));
  },
};

export const getProjectProgressTool: ToolDefinition = {
  name: 'get_project_progress', description: '查询项目完成进度。当用户问"完成多少了"、"进度怎么样"时调用。',
  category: 'work', access: 'read', requiresConfirmation: false, preferredModel: 'fast',
  parameters: { type: 'object', properties: { projectId: { type: 'string' }, projectName: { type: 'string', description: '项目名模糊匹配' } } },
  handler: async (args, userId) => {
    let project;
    if (args.projectId) project = await prisma.project.findFirst({ where: { id: args.projectId as string, ownerId: userId } });
    else if (args.projectName) project = await prisma.project.findFirst({ where: { ownerId: userId, name: { contains: args.projectName as string } } });
    if (!project) return { error: '未找到项目' };
    const tasks = await prisma.task.findMany({ where: { projectId: project.id } });
    const done = tasks.filter(t => t.status === 'DONE').length;
    const total = tasks.length;
    return { projectName: project.name, status: project.status, total, done, inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length, blocked: tasks.filter(t => t.status === 'BLOCKED').length, percent: total > 0 ? Math.round((done / total) * 100) + '%' : '0%' };
  },
};
