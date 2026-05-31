// 项目 + 任务 + 客户 完整 CRUD 工具
import { prisma } from '../../server';
import { ToolDefinition } from './types';

// ═══════════════════════════════════════════
//  项目（完整字段）
// ═══════════════════════════════════════════

export const createProjectTool: ToolDefinition = {
  name: 'create_project',
  description:
    '创建新项目。支持设置项目名称、描述、类型标签（开发/设计/运营/咨询）、预算（元）、开始日期、截止日期、关联客户、支出说明、报酬说明。'
    + '用户说"新建项目"、"开个项目"、"加个项目"时调用。'
    + '没说的字段用默认值（开始日期=今天，状态=进行中），不追问。写操作，需确认。',
  category: 'work', access: 'write', requiresConfirmation: true, preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      name:        { type: 'string', description: '项目名称，必填' },
      description: { type: 'string', description: '项目描述/详情，用户说了就填' },
      type:        { type: 'string', description: '项目类型标签：开发/设计/运营/咨询/营销等' },
      budget:      { type: 'number', description: '预算（元），如 5000 表示 ¥5,000' },
      startDate:   { type: 'string', description: '开始日期 YYYY-MM-DD，默认今天' },
      endDate:     { type: 'string', description: '截止日期/预计完成日期 YYYY-MM-DD' },
      customerName:{ type: 'string', description: '关联客户名，模糊匹配' },
      expenseNote: { type: 'string', description: '支出/成本说明' },
      rewardNote:  { type: 'string', description: '报酬/收入说明' },
    },
    required: ['name'],
  },
  handler: async (args, userId) => {
    let customerId: string | undefined;
    if (args.customerName) {
      const c = await prisma.customer.findFirst({ where: { userId, name: { contains: args.customerName as string } } });
      if (c) customerId = c.id;
    }
    const project = await prisma.project.create({
      data: {
        name: args.name as string,
        description: (args.description as string) || null,
        type: (args.type as string) || null,
        budget: args.budget != null ? Math.round((args.budget as number) * 100) : 0,
        startDate: args.startDate ? new Date(args.startDate as string) : new Date(),
        endDate: args.endDate ? new Date(args.endDate as string) : null,
        ownerId: userId, customerId,
        expenseNote: (args.expenseNote as string) || null,
        rewardNote: (args.rewardNote as string) || null,
        status: 'ACTIVE',
      },
    });
    const details: Record<string, string> = { '名称': project.name, '状态': '进行中' };
    if (args.type) details['类型'] = args.type as string;
    if (args.budget != null) details['预算'] = `¥${args.budget}`;
    if (args.description) details['描述'] = (args.description as string).slice(0, 30);
    if (args.endDate) details['截止'] = args.endDate as string;
    return { success: true, action: '创建项目', summary: `已创建项目「${project.name}」`, details };
  },
};

export const updateProjectTool: ToolDefinition = {
  name: 'update_project',
  description:
    '更新项目信息。支持修改名称、状态（ACTIVE/COMPLETED/ARCHIVED）、预算、类型标签、描述、截止日期。'
    + '用户说"改项目"、"更新项目"、"把XX项目改为已完成"、"加个截止日期"时调用。写操作，需确认。',
  category: 'work', access: 'write', requiresConfirmation: true, preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      projectId:   { type: 'string', description: '项目 ID' },
      projectName: { type: 'string', description: '项目名，模糊匹配' },
      name:        { type: 'string', description: '新名称' },
      status:      { type: 'string', enum: ['ACTIVE', 'COMPLETED', 'ARCHIVED'] },
      budget:      { type: 'number', description: '新预算（元）' },
      type:        { type: 'string', description: '新类型标签' },
      description: { type: 'string', description: '新描述' },
      endDate:     { type: 'string', description: '新截止日期 YYYY-MM-DD' },
    },
    required: [],
  },
  handler: async (args, userId) => {
    let pid = args.projectId as string | undefined;
    if (!pid && args.projectName) {
      const p = await prisma.project.findFirst({ where: { ownerId: userId, name: { contains: args.projectName as string } } });
      if (!p) return { error: `未找到项目「${args.projectName}」` };
      pid = p.id;
    }
    if (!pid) return { error: '请提供项目 ID 或名称' };
    const data: Record<string, unknown> = {};
    if (args.name) data.name = args.name;
    if (args.status) data.status = args.status;
    if (args.budget != null) data.budget = Math.round((args.budget as number) * 100);
    if (args.type) data.type = args.type;
    if (args.description !== undefined) data.description = args.description;
    if (args.endDate) data.endDate = new Date(args.endDate as string);
    await prisma.project.updateMany({ where: { id: pid, ownerId: userId }, data });
    const p = await prisma.project.findUnique({ where: { id: pid } });
    return { success: true, action: '更新项目', summary: `已更新项目「${p?.name}」`, details: { '名称': p?.name || '', '状态': p?.status || '' } };
  },
};

// ═══════════════════════════════════════════
//  任务（完整字段）
// ═══════════════════════════════════════════

export const createTaskTool: ToolDefinition = {
  name: 'create_task',
  description:
    '创建新任务。支持设置任务标题、详细描述、优先级（URGENT紧急/HIGH高/MEDIUM中/LOW低）、预估工时（小时）、开始日期、截止日期、关联项目、负责人、父任务、花销。'
    + '用户说"创建任务"、"加个待办"、"帮我记一下"、"建个任务"时调用。'
    + '没说的字段用默认值（优先级=MEDIUM，工时=1h，项目=第一个活跃项目），不追问。写操作，需确认。',
  category: 'work', access: 'write', requiresConfirmation: true, preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      title:          { type: 'string', description: '任务标题，必填' },
      description:    { type: 'string', description: '任务详细描述/备注' },
      priority:       { type: 'string', enum: ['URGENT', 'HIGH', 'MEDIUM', 'LOW'], default: 'MEDIUM', description: '紧急/高/中/低' },
      estimatedHours: { type: 'number', default: 1, description: '预估工时（小时）' },
      startDate:      { type: 'string', description: '开始日期 YYYY-MM-DD' },
      dueDate:        { type: 'string', description: '截止日期 YYYY-MM-DD' },
      projectId:      { type: 'string', description: '项目ID' },
      projectName:    { type: 'string', description: '项目名，模糊匹配' },
      assigneeName:   { type: 'string', description: '负责人名，模糊匹配' },
      parentTitle:    { type: 'string', description: '父任务标题，模糊匹配（创建子任务时用）' },
      cost:           { type: 'number', description: '任务花销（元）' },
      costNote:       { type: 'string', description: '花销说明' },
    },
    required: ['title'],
  },
  handler: async (args, userId) => {
    let projectId = args.projectId as string | undefined;
    if (!projectId && args.projectName) {
      const p = await prisma.project.findFirst({ where: { ownerId: userId, name: { contains: args.projectName as string }, status: 'ACTIVE' } });
      if (p) projectId = p.id; else return { error: `未找到项目「${args.projectName}」` };
    }
    if (!projectId) {
      const p = await prisma.project.findFirst({ where: { ownerId: userId, status: 'ACTIVE' } });
      if (!p) return { error: '没有活跃项目，请先创建项目' };
      projectId = p.id;
    }
    const project = await prisma.project.findFirst({ where: { id: projectId, ownerId: userId } });
    if (!project) return { error: '项目不存在或无权访问' };
    if (project.status === 'COMPLETED') return { error: '项目已完成，不能创建新任务' };

    let assigneeId: string | undefined;
    if (args.assigneeName) {
      const u = await prisma.user.findFirst({ where: { name: { contains: args.assigneeName as string } } });
      if (u) assigneeId = u.id;
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
        assigneeId, parentId,
        cost: args.cost ? Math.round((args.cost as number) * 100) : 0,
        costNote: (args.costNote as string) || undefined,
        status: 'TODO',
      },
    });

    const prioLabel: Record<string, string> = { URGENT: '紧急', HIGH: '高', MEDIUM: '中', LOW: '低' };
    const details: Record<string, string> = { '任务': task.title, '项目': project.name, '优先级': prioLabel[task.priority] || task.priority, '工时': `${task.estimatedHours}h` };
    if (task.dueDate) details['截止'] = task.dueDate.toISOString().split('T')[0];
    if (parentId) details['父任务'] = args.parentTitle as string;
    if (args.description) details['描述'] = (args.description as string).slice(0, 30);
    return { success: true, action: '创建任务', summary: `已创建任务「${task.title}」`, details };
  },
};

// ═══ 更新任务 ═══

export const updateTaskStatusTool: ToolDefinition = {
  name: 'update_task_status',
  description:
    '更新任务状态或优先级。支持改为待办/进行中/已完成/阻塞，修改优先级，填写阻塞原因。'
    + '用户说"完成XX"、"标记XX为完成"、"XX做完了"、"改为进行中"、"阻塞了"、"提高优先级"时调用。支持模糊匹配任务名。写操作，需确认。',
  category: 'work', access: 'write', requiresConfirmation: true, preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      taskId:        { type: 'string', description: '任务 ID（精确匹配）' },
      taskTitle:     { type: 'string', description: '任务名，模糊匹配' },
      status:        { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED'] },
      priority:      { type: 'string', enum: ['URGENT', 'HIGH', 'MEDIUM', 'LOW'] },
      blockedReason: { type: 'string', description: '阻塞原因（状态改为 BLOCKED 时填写）' },
      projectName:   { type: 'string', description: '限定项目名（有同名任务时用）' },
    },
    required: [],
  },
  handler: async (args, userId) => {
    let task;
    if (args.taskId) task = await prisma.task.findFirst({ where: { id: args.taskId as string, project: { ownerId: userId } } });
    else if (args.taskTitle) {
      const where: Record<string, unknown> = { title: { contains: args.taskTitle as string }, project: { ownerId: userId }, status: { not: 'DONE' } };
      if (args.projectName) { const proj = await prisma.project.findFirst({ where: { ownerId: userId, name: { contains: args.projectName as string } } }); if (proj) where.projectId = proj.id; }
      task = await prisma.task.findFirst({ where });
    }
    if (!task) return { error: '未找到匹配任务' };
    const data: Record<string, unknown> = {};
    if (args.status) { data.status = args.status; if (args.status === 'DONE') data.completedAt = new Date(); }
    if (args.priority) data.priority = args.priority;
    if (args.blockedReason) data.blockedReason = args.blockedReason;
    const updated = await prisma.task.update({ where: { id: task.id }, data });
    const sLabel: Record<string, string> = { TODO: '待办', IN_PROGRESS: '进行中', DONE: '已完成', BLOCKED: '阻塞' };
    return { success: true, action: '更新任务', summary: `已更新「${updated.title}」`, details: { '任务': updated.title, ...(args.status ? { '状态': sLabel[args.status as string] } : {}), ...(args.priority ? { '优先级': args.priority as string } : {}) } };
  },
};

export const deleteTaskTool: ToolDefinition = {
  name: 'delete_task',
  description: '删除任务。⚠️ 不可恢复。用户说"删除XX任务"、"删掉XX"时调用。写操作，需先确认。',
  category: 'work', access: 'write', requiresConfirmation: true, preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      taskId:    { type: 'string', description: '任务 ID' },
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

// ═══ 记录工时 + 查询排期 ═══

export const logTimeTool: ToolDefinition = {
  name: 'log_time',
  description:
    '记录工时。用户说"花了X小时"、"记录了X小时"、"在XX项目上做了X小时"、"今天工作了X小时"时调用。'
    + '项目名和任务名可选，模糊匹配。日期默认今天。写操作，需确认。',
  category: 'work', access: 'write', requiresConfirmation: true, preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      projectName: { type: 'string', description: '项目名，模糊匹配' },
      taskTitle:   { type: 'string', description: '任务名，模糊匹配' },
      hours:       { type: 'number', description: '工时数（小时）' },
      date:        { type: 'string', description: '日期 YYYY-MM-DD，默认今天' },
      description: { type: 'string', description: '工作内容描述' },
    },
    required: ['hours'],
  },
  handler: async (args, userId) => {
    let projectId: string | undefined, taskId: string | undefined;
    if (args.projectName) { const p = await prisma.project.findFirst({ where: { ownerId: userId, name: { contains: args.projectName as string } } }); if (p) projectId = p.id; }
    if (args.taskTitle && projectId) { const t = await prisma.task.findFirst({ where: { projectId, title: { contains: args.taskTitle as string } } }); if (t) taskId = t.id; }
    const entry = await prisma.timeEntry.create({ data: { userId, projectId, taskId, hours: args.hours as number, date: args.date ? new Date(args.date as string) : new Date(), description: (args.description as string) || undefined } });
    return { success: true, action: '记录工时', summary: `已记录 ${args.hours}h`, details: { '工时': `${args.hours}h`, '日期': entry.date.toISOString().split('T')[0], '项目': (args.projectName as string) || '未关联' } };
  },
};

export const getScheduleTool: ToolDefinition = {
  name: 'get_schedule',
  description: '查询项目排期/甘特图。用户问"排期"、"时间安排"、"什么时候能做完"、"项目时间线"时调用。',
  category: 'work', access: 'read', requiresConfirmation: false, preferredModel: 'fast',
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
