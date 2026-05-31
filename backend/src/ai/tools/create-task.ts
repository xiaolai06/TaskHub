import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const createTaskTool: ToolDefinition = {
  name: 'create_task', description: '创建新任务。写操作，需确认。', category: 'work', access: 'write', requiresConfirmation: true, preferredModel: 'fast',
  parameters: { type: 'object', properties: { title: { type: 'string' }, projectId: { type: 'string' }, projectName: { type: 'string', description: '项目名模糊匹配' }, priority: { type: 'string', enum: ['URGENT','HIGH','MEDIUM','LOW'], default: 'MEDIUM' }, estimatedHours: { type: 'number', default: 1 }, dueDate: { type: 'string' }, description: { type: 'string' } }, required: ['title'] },
  handler: async (args, userId) => {
    let projectId = args.projectId as string | undefined;
    if (!projectId && args.projectName) { const p = await prisma.project.findFirst({ where: { ownerId: userId, name: { contains: args.projectName as string }, status: 'ACTIVE' } }); if (p) projectId = p.id; else return { error: `未找到项目「${args.projectName}」` }; }
    if (!projectId) { const p = await prisma.project.findFirst({ where: { ownerId: userId, status: 'ACTIVE' } }); if (!p) return { error: '没有活跃项目' }; projectId = p.id; }
    const project = await prisma.project.findFirst({ where: { id: projectId, ownerId: userId } });
    if (!project) return { error: '项目不存在' }; if (project.status === 'COMPLETED') return { error: '项目已完成' };
    const task = await prisma.task.create({ data: { title: args.title as string, projectId, priority: (args.priority as string) || 'MEDIUM', estimatedHours: (args.estimatedHours as number) || 1, dueDate: args.dueDate ? new Date(args.dueDate as string) : null, description: args.description as string, status: 'TODO' } });
    return { success: true, action: '创建任务', summary: `已创建任务「${task.title}」`, details: { '任务名称': task.title, '所属项目': project.name, '优先级': task.priority, '预估工时': `${task.estimatedHours}h`, '截止日期': task.dueDate ? task.dueDate.toISOString().split('T')[0] : '未设定' } };
  },
};

export const updateTaskStatusTool: ToolDefinition = {
  name: 'update_task_status', description: '更新任务状态。写操作，需确认。', category: 'work', access: 'write', requiresConfirmation: true, preferredModel: 'fast',
  parameters: { type: 'object', properties: { taskId: { type: 'string' }, taskTitle: { type: 'string' }, status: { type: 'string', enum: ['TODO','IN_PROGRESS','DONE','BLOCKED'] }, priority: { type: 'string', enum: ['URGENT','HIGH','MEDIUM','LOW'] } }, required: ['taskTitle'] },
  handler: async (args, userId) => {
    let task;
    if (args.taskId) task = await prisma.task.findFirst({ where: { id: args.taskId as string, project: { ownerId: userId } } });
    else task = await prisma.task.findFirst({ where: { title: { contains: args.taskTitle as string }, project: { ownerId: userId }, status: { not: 'DONE' } } });
    if (!task) return { error: `未找到任务「${args.taskTitle}」` };
    const data: Record<string, unknown> = {};
    if (args.status) { data.status = args.status; if (args.status === 'DONE') data.completedAt = new Date(); }
    if (args.priority) data.priority = args.priority;
    const updated = await prisma.task.update({ where: { id: task.id }, data });
    return { success: true, action: '更新任务', summary: `已更新「${updated.title}」`, details: { '任务名称': updated.title, '状态': updated.status, '优先级': updated.priority } };
  },
};

export const logTimeTool: ToolDefinition = {
  name: 'log_time', description: '记录工时。写操作，需确认。', category: 'work', access: 'write', requiresConfirmation: true, preferredModel: 'fast',
  parameters: { type: 'object', properties: { projectName: { type: 'string' }, taskTitle: { type: 'string' }, hours: { type: 'number' }, date: { type: 'string' }, description: { type: 'string' } }, required: ['hours'] },
  handler: async (args, userId) => {
    let projectId: string | undefined, taskId: string | undefined;
    if (args.projectName) { const p = await prisma.project.findFirst({ where: { ownerId: userId, name: { contains: args.projectName as string } } }); if (p) projectId = p.id; }
    if (args.taskTitle && projectId) { const t = await prisma.task.findFirst({ where: { projectId, title: { contains: args.taskTitle as string } } }); if (t) taskId = t.id; }
    const entry = await prisma.timeEntry.create({ data: { userId, projectId, taskId, hours: args.hours as number, date: args.date ? new Date(args.date as string) : new Date(), description: args.description as string } });
    return { success: true, action: '记录工时', summary: `已记录 ${args.hours} 小时`, details: { '工时': `${args.hours}h`, '日期': entry.date.toISOString().split('T')[0], '项目': args.projectName as string || '未关联' } };
  },
};

export const getScheduleTool: ToolDefinition = {
  name: 'get_schedule', description: '查询排期。当用户问"排期"、"时间安排"时调用。', category: 'work', access: 'read', requiresConfirmation: false, preferredModel: 'fast',
  parameters: { type: 'object', properties: { projectId: { type: 'string' }, projectName: { type: 'string' } } },
  handler: async (args, userId) => {
    let projectId = args.projectId as string | undefined;
    if (!projectId && args.projectName) { const p = await prisma.project.findFirst({ where: { ownerId: userId, name: { contains: args.projectName as string } } }); if (p) projectId = p.id; }
    if (!projectId) return { error: '请指定项目' };
    const { calculateSchedule } = await import('../../services/scheduler.service');
    const result = await calculateSchedule(userId, { projectId, dailyHourLimit: 8 });
    return { tasks: result.tasks.slice(0, 5), total: result.summary.totalTasks, summary: { totalHours: result.summary.totalHours, delayedTasks: result.summary.delayedTasks, projectEnd: result.summary.projectEnd } };
  },
};
