import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const createTaskTool: ToolDefinition = {
  name: 'create_task',
  description:
    '创建新任务。支持标题、描述、优先级、预估工时、最早开始、截止日期、关联项目、负责人、父任务和任务成本。'
    + '用户说“创建任务”“加个待办”“帮我记一个”“建个任务”时调用。没说项目时使用第一个进行中的项目。写操作需确认。',
  category: 'work',
  access: 'write',
  requiresConfirmation: true,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: '任务标题，必填' },
      description: { type: 'string', description: '任务描述或备注' },
      priority: { type: 'string', enum: ['URGENT', 'HIGH', 'MEDIUM', 'LOW'], default: 'MEDIUM', description: '紧急/高/中/低' },
      estimatedHours: { type: 'number', default: 1, description: '预估工时（小时）' },
      startDate: { type: 'string', description: '最早开始日期 YYYY-MM-DD' },
      dueDate: { type: 'string', description: '截止日期 YYYY-MM-DD' },
      projectId: { type: 'string', description: '项目 ID' },
      projectName: { type: 'string', description: '项目名，模糊匹配' },
      assigneeName: { type: 'string', description: '负责人姓名，模糊匹配' },
      parentTitle: { type: 'string', description: '父任务标题，模糊匹配' },
      cost: { type: 'number', description: '任务成本（元）' },
      costNote: { type: 'string', description: '成本说明' },
    },
    required: ['title'],
  },
  handler: async (args, userId) => {
    let projectId = args.projectId as string | undefined;
    if (!projectId && args.projectName) {
      const project = await prisma.project.findFirst({ where: { ownerId: userId, name: { contains: args.projectName as string }, status: 'ACTIVE' } });
      if (!project) return { error: `未找到项目「${args.projectName}」` };
      projectId = project.id;
    }
    if (!projectId) {
      const project = await prisma.project.findFirst({ where: { ownerId: userId, status: 'ACTIVE' } });
      if (!project) return { error: '没有进行中的项目，请先创建项目' };
      projectId = project.id;
    }

    const project = await prisma.project.findFirst({ where: { id: projectId, ownerId: userId } });
    if (!project) return { error: '项目不存在或无权访问' };
    if (project.status === 'COMPLETED') return { error: '项目已完成，不能创建新任务' };

    let assigneeId: string | undefined;
    if (args.assigneeName) {
      const user = await prisma.user.findFirst({ where: { name: { contains: args.assigneeName as string } } });
      if (user) assigneeId = user.id;
    }

    let parentId: string | undefined;
    if (args.parentTitle) {
      const parent = await prisma.task.findFirst({ where: { projectId, title: { contains: args.parentTitle as string } } });
      if (parent) parentId = parent.id;
    }

    const task = await prisma.task.create({
      data: {
        title: args.title as string,
        projectId,
        description: (args.description as string) || undefined,
        priority: (args.priority as string) || 'MEDIUM',
        estimatedHours: (args.estimatedHours as number) ?? 1,
        startDate: args.startDate ? new Date(args.startDate as string) : null,
        dueDate: args.dueDate ? new Date(args.dueDate as string) : null,
        assigneeId,
        parentId,
        cost: args.cost ? Math.round((args.cost as number) * 100) : 0,
        costNote: (args.costNote as string) || undefined,
        status: 'TODO',
      },
    });

    const priorityLabel: Record<string, string> = { URGENT: '紧急', HIGH: '高', MEDIUM: '中', LOW: '低' };
    const details: Record<string, string> = {
      任务: task.title,
      项目: project.name,
      优先级: priorityLabel[task.priority] || task.priority,
      工时: `${task.estimatedHours}h`,
    };
    if (task.dueDate) details['截止'] = task.dueDate.toISOString().split('T')[0];
    if (parentId) details['父任务'] = args.parentTitle as string;
    if (args.description) details['描述'] = (args.description as string).slice(0, 30);
    return { success: true, action: '创建任务', summary: `已创建任务「${task.title}」`, details };
  },
};

export const updateTaskStatusTool: ToolDefinition = {
  name: 'update_task_status',
  description:
    '更新任务状态或优先级。支持改为待办、进行中、已完成、阻塞，修改优先级，填写阻塞原因。'
    + '用户说“完成XX”“标记XX为完成”“XX做完了”“改为进行中”“阻塞了”“提高优先级”时调用。写操作需确认。',
  category: 'work',
  access: 'write',
  requiresConfirmation: true,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: '任务 ID' },
      taskTitle: { type: 'string', description: '任务名，模糊匹配' },
      status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED'] },
      priority: { type: 'string', enum: ['URGENT', 'HIGH', 'MEDIUM', 'LOW'] },
      blockedReason: { type: 'string', description: '阻塞原因' },
      projectName: { type: 'string', description: '限定项目名' },
    },
    required: [],
  },
  handler: async (args, userId) => {
    let task;
    if (args.taskId) {
      task = await prisma.task.findFirst({ where: { id: args.taskId as string, project: { ownerId: userId } } });
    } else if (args.taskTitle) {
      const where: Record<string, unknown> = { title: { contains: args.taskTitle as string }, project: { ownerId: userId }, status: { not: 'DONE' } };
      if (args.projectName) {
        const project = await prisma.project.findFirst({ where: { ownerId: userId, name: { contains: args.projectName as string } } });
        if (project) where.projectId = project.id;
      }
      task = await prisma.task.findFirst({ where });
    }
    if (!task) return { error: '未找到匹配任务' };

    const data: Record<string, unknown> = {};
    if (args.status) {
      data.status = args.status;
      if (args.status === 'DONE') data.completedAt = new Date();
    }
    if (args.priority) data.priority = args.priority;
    if (args.blockedReason) data.blockedReason = args.blockedReason;

    const updated = await prisma.task.update({ where: { id: task.id }, data });
    const statusLabel: Record<string, string> = { TODO: '待办', IN_PROGRESS: '进行中', DONE: '已完成', BLOCKED: '阻塞' };
    return {
      success: true,
      action: '更新任务',
      summary: `已更新「${updated.title}」`,
      details: {
        任务: updated.title,
        ...(args.status ? { 状态: statusLabel[args.status as string] } : {}),
        ...(args.priority ? { 优先级: args.priority as string } : {}),
      },
    };
  },
};

export const deleteTaskTool: ToolDefinition = {
  name: 'delete_task',
  description: '删除任务。不可恢复。用户说“删除XX任务”“删掉XX”时调用。写操作需确认。',
  category: 'work',
  access: 'write',
  requiresConfirmation: true,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: '任务 ID' },
      taskTitle: { type: 'string', description: '任务名，模糊匹配' },
    },
    required: [],
  },
  handler: async (args, userId) => {
    let task;
    if (args.taskId) task = await prisma.task.findFirst({ where: { id: args.taskId as string, project: { ownerId: userId } } });
    else if (args.taskTitle) task = await prisma.task.findFirst({ where: { title: { contains: args.taskTitle as string }, project: { ownerId: userId } } });
    if (!task) return { error: '未找到任务' };
    await prisma.task.delete({ where: { id: task.id } });
    return { success: true, action: '删除任务', summary: `已删除任务「${task.title}」`, details: {} };
  },
};

export const logTimeTool: ToolDefinition = {
  name: 'log_time',
  description:
    '记录工时。用户说“花了X小时”“记录了X小时”“在XX项目上做了X小时”“今天工作了X小时”时调用。项目和任务可选，日期默认今天。写操作需确认。',
  category: 'work',
  access: 'write',
  requiresConfirmation: true,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      projectName: { type: 'string', description: '项目名，模糊匹配' },
      taskTitle: { type: 'string', description: '任务名，模糊匹配' },
      hours: { type: 'number', description: '工时数（小时）' },
      date: { type: 'string', description: '日期 YYYY-MM-DD，默认今天' },
      description: { type: 'string', description: '工作内容描述' },
    },
    required: ['hours'],
  },
  handler: async (args, userId) => {
    let projectId: string | undefined;
    let taskId: string | undefined;
    if (args.projectName) {
      const project = await prisma.project.findFirst({ where: { ownerId: userId, name: { contains: args.projectName as string } } });
      if (project) projectId = project.id;
    }
    if (args.taskTitle && projectId) {
      const task = await prisma.task.findFirst({ where: { projectId, title: { contains: args.taskTitle as string } } });
      if (task) taskId = task.id;
    }
    const entry = await prisma.timeEntry.create({
      data: {
        userId,
        projectId,
        taskId,
        hours: args.hours as number,
        date: args.date ? new Date(args.date as string) : new Date(),
        description: (args.description as string) || undefined,
      },
    });
    return {
      success: true,
      action: '记录工时',
      summary: `已记录 ${args.hours}h`,
      details: { 工时: `${args.hours}h`, 日期: entry.date.toISOString().split('T')[0], 项目: (args.projectName as string) || '未关联' },
    };
  },
};

export const getScheduleTool: ToolDefinition = {
  name: 'get_schedule',
  description: '查询项目排期。用户问“排期”“时间安排”“什么时候能做完”“项目时间线”时调用。',
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
    const { calculateSchedule } = await import('../../services/scheduler.service');
    const result = await calculateSchedule(userId, { projectId, dailyHourLimit: 8 });
    return {
      tasks: result.tasks.slice(0, 5),
      total: result.summary.totalTasks,
      summary: {
        totalHours: result.summary.totalHours,
        delayedTasks: result.summary.delayedTasks,
        projectEnd: result.summary.projectEnd,
      },
    };
  },
};