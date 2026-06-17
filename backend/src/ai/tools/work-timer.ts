import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const getTodayEntriesTool: ToolDefinition = {
  name: 'get_today_entries',
  description: `今日已记录工时。

使用时机:
- "今天记了多少工时"、"今日工时"、"今天工作了多久"

不使用时机:
- 工时统计 → 用 get_time_analysis
- 记录工时 → 用 log_time

返回数据: entries(totalHours/count)/date`,
  category: 'work_timer',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {},
  },
  handler: async (_args, userId) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const entries = await prisma.timeEntry.findMany({
      where: { userId, date: { gte: today, lt: tomorrow } },
      include: { project: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const totalHours = entries.reduce((s, e) => s + e.hours, 0);

    return {
      meta: { tool: 'get_today_entries', date: today.toISOString().split('T')[0] },
      highlights: { totalHours, count: entries.length },
      summary: `今日记录 ${totalHours}h（${entries.length} 条工时）`,
      data: entries.map(e => ({
        id: e.id,
        hours: e.hours,
        project: e.project?.name || '未关联',
        description: e.description,
      })),
    };
  },
};

export const getActiveTimerTool: ToolDefinition = {
  name: 'get_active_timer',
  description: `当前运行的计时器。

使用时机:
- "有没有在计时"、"当前计时器"、"正在计时吗"

不使用时机:
- 今日工时 → 用 get_today_entries
- 记录工时 → 用 log_time

返回数据: activeTimer(id/startedAt/elapsed/description/taskId) 或 null`,
  category: 'work_timer',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {},
  },
  handler: async (_args, userId) => {
    const timer = await prisma.workTimer.findFirst({
      where: { userId, active: true },
      orderBy: { startedAt: 'desc' },
    });

    if (!timer) {
      return {
        meta: { tool: 'get_active_timer' },
        highlights: { hasActiveTimer: false },
        summary: '当前没有运行中的计时器',
        data: null,
      };
    }

    const elapsed = Math.floor((Date.now() - timer.startedAt.getTime()) / 60000);
    return {
      meta: { tool: 'get_active_timer' },
      highlights: { hasActiveTimer: true, elapsed },
      summary: `计时器已运行 ${elapsed} 分钟`,
      data: {
        id: timer.id,
        startedAt: timer.startedAt.toISOString(),
        elapsedMinutes: elapsed,
        description: timer.description,
      },
    };
  },
};

export const listTodosTool: ToolDefinition = {
  name: 'list_todos',
  description: `今日待办列表。

使用时机:
- "今天待办"、"待办清单"、"有什么要做的"

不使用时机:
- 任务列表 → 用 list_tasks
- 今日焦点 → 用 get_today_focus

返回数据: todos(completed/content)/progress`,
  category: 'work_timer',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {},
  },
  handler: async (_args, userId) => {
    const todos = await prisma.todayTodo.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    const completed = todos.filter(t => t.completed).length;
    return {
      meta: { tool: 'list_todos', total: todos.length },
      highlights: { total: todos.length, completed, pending: todos.length - completed },
      summary: `今日 ${todos.length} 个待办，${completed} 个已完成`,
      data: todos.map(t => ({
        id: t.id,
        content: t.content,
        completed: t.completed,
      })),
    };
  },
};

export const addTodoTool: ToolDefinition = {
  name: 'add_todo',
  description: '添加今日待办。用户说"加个待办""记一下""提醒我要做XX"时调用。写操作需确认。',
  category: 'work_timer',
  access: 'write',
  requiresConfirmation: true,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      content: { type: 'string', description: '待办内容' },
    },
    required: ['content'],
  },
  handler: async (args, userId) => {
    const todo = await prisma.todayTodo.create({
      data: { userId, content: args.content as string },
    });
    return {
      success: true,
      action: '添加待办',
      summary: `已添加待办「${todo.content}」`,
      details: { 内容: todo.content },
    };
  },
};

export const toggleTodoTool: ToolDefinition = {
  name: 'toggle_todo',
  description: `切换待办的完成状态。未完成→已完成，已完成→未完成。

使用时机:
- "完成XX待办"、"XX做好了"、"取消完成XX"

不使用时机:
- 新增待办 → 用 add_todo
- 删除待办 → 请联系前端操作`,
  category: 'work_timer',
  access: 'write',
  requiresConfirmation: true,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      todoId: { type: 'string', description: '待办 ID' },
      content: { type: 'string', description: '待办内容，模糊匹配' },
    },
    required: [],
  },
  handler: async (args, userId) => {
    let todoId = args.todoId as string | undefined;
    if (!todoId && args.content) {
      const todo = await prisma.todayTodo.findFirst({ where: { userId, content: { contains: args.content as string } } });
      if (todo) todoId = todo.id;
    }
    if (!todoId) return { error: '请指定待办' };

    const todo = await prisma.todayTodo.findFirst({ where: { id: todoId, userId } });
    if (!todo) return { error: '未找到该待办' };

    const updated = await prisma.todayTodo.update({
      where: { id: todo.id },
      data: { completed: !todo.completed },
    });

    return {
      success: true,
      action: updated.completed ? '完成待办' : '取消完成',
      summary: updated.completed ? `已完成「${updated.content}」` : `已取消完成「${updated.content}」`,
      details: { 内容: updated.content, 状态: updated.completed ? '已完成' : '未完成' },
    };
  },
};
