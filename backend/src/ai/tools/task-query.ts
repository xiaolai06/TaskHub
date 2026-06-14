import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const listTasksTool: ToolDefinition = {
  name: 'list_tasks',
  description: `任务列表，支持状态/优先级/项目筛选。

使用时机:
- "查看任务"、"有哪些任务"、"未完成的任务"
- "XX项目的任务"、"紧急任务"

不使用时机:
- 今日焦点 → 用 get_today_focus
- 逾期任务 → 用 get_overdue_tasks
- 创建任务 → 用 create_task

返回数据: 任务列表含 title/status/priority/project/estimatedHours/dueDate`,
  category: 'work',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED'], description: '筛选状态' },
      priority: { type: 'string', enum: ['URGENT', 'HIGH', 'MEDIUM', 'LOW'], description: '筛选优先级' },
      projectId: { type: 'string', description: '按项目筛选' },
      projectName: { type: 'string', description: '项目名，模糊匹配' },
      limit: { type: 'number', description: '返回条数，默认 20' },
    },
  },
  handler: async (args, userId) => {
    const where: Record<string, unknown> = { project: { ownerId: userId } };
    if (args.status) where.status = args.status;
    if (args.priority) where.priority = args.priority;

    let projectId = args.projectId as string | undefined;
    if (!projectId && args.projectName) {
      const project = await prisma.project.findFirst({ where: { ownerId: userId, name: { contains: args.projectName as string } } });
      if (project) projectId = project.id;
    }
    if (projectId) where.projectId = projectId;

    const limit = (args.limit as number) || 20;
    const tasks = await prisma.task.findMany({
      where,
      take: limit,
      orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
      include: { project: { select: { name: true } } },
    });

    const statusLabel: Record<string, string> = { TODO: '待办', IN_PROGRESS: '进行中', DONE: '已完成', BLOCKED: '阻塞' };
    const priorityLabel: Record<string, string> = { URGENT: '紧急', HIGH: '高', MEDIUM: '中', LOW: '低' };

    return {
      meta: { tool: 'list_tasks', total: tasks.length, statusFilter: args.status || '全部', priorityFilter: args.priority || '全部' },
      highlights: {
        total: tasks.length,
        todo: tasks.filter(t => t.status === 'TODO').length,
        inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
        blocked: tasks.filter(t => t.status === 'BLOCKED').length,
      },
      summary: `${tasks.length} 个任务（${tasks.filter(t => t.status === 'TODO').length} 待办, ${tasks.filter(t => t.status === 'IN_PROGRESS').length} 进行中, ${tasks.filter(t => t.status === 'BLOCKED').length} 阻塞）`,
      data: tasks.map(t => ({
        id: t.id,
        title: t.title,
        status: statusLabel[t.status] || t.status,
        priority: priorityLabel[t.priority] || t.priority,
        project: t.project.name,
        estimatedHours: t.estimatedHours,
        dueDate: t.dueDate?.toISOString().split('T')[0] || null,
      })),
    };
  },
};

export const getTaskStatsTool: ToolDefinition = {
  name: 'get_task_stats',
  description: `任务统计概览：总数/各状态分布/完成率/逾期数/平均工时。

使用时机:
- "任务统计"、"完成率多少"、"有多少任务"
- "任务情况怎么样"

不使用时机:
- 任务列表 → 用 list_tasks
- 今日焦点 → 用 get_today_focus
- 业务健康度 → 用 get_business_health

返回数据: total/done/todo/inProgress/blocked/overdue/completionRate/avgHours`,
  category: 'work',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: '按项目统计' },
    },
  },
  handler: async (args, userId) => {
    const baseWhere: Record<string, unknown> = { project: { ownerId: userId } };
    if (args.projectId) baseWhere.projectId = args.projectId;

    const [total, done, todo, inProgress, blocked] = await Promise.all([
      prisma.task.count({ where: baseWhere }),
      prisma.task.count({ where: { ...baseWhere, status: 'DONE' } }),
      prisma.task.count({ where: { ...baseWhere, status: 'TODO' } }),
      prisma.task.count({ where: { ...baseWhere, status: 'IN_PROGRESS' } }),
      prisma.task.count({ where: { ...baseWhere, status: 'BLOCKED' } }),
    ]);

    const overdue = await prisma.task.count({
      where: { ...baseWhere, status: { notIn: ['DONE'] }, dueDate: { lt: new Date() } },
    });

    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

    return {
      meta: { tool: 'get_task_stats' },
      highlights: { total, done, completionRate: `${completionRate}%`, overdue },
      summary: `共 ${total} 个任务，完成率 ${completionRate}%，${overdue} 个逾期`,
      data: {
        total,
        done,
        todo,
        inProgress,
        blocked,
        overdue,
        completionRate: `${completionRate}%`,
      },
    };
  },
};
