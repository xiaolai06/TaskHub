import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const listGoalsTool: ToolDefinition = {
  name: 'list_goals',
  description: `目标列表，支持类型和状态筛选。

使用时机:
- "查看目标"、"目标列表"、"有哪些目标"
- "月度目标"、"季度目标"

不使用时机:
- 目标进度详情 → 用 get_goal_progress
- 目标总览 → 用 get_goal_overview
- 创建目标 → 用 create_goal

返回数据: 目标列表含 title/type/status/target/current/percent/endDate`,
  category: 'goal',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['MONTHLY', 'QUARTERLY', 'YEARLY'], description: '筛选类型' },
      status: { type: 'string', enum: ['ACTIVE', 'COMPLETED', 'ABANDONED', 'AT_RISK'], description: '筛选状态' },
    },
  },
  handler: async (args, userId) => {
    const where: Record<string, unknown> = { userId };
    if (args.type) where.type = args.type;
    if (args.status) where.status = args.status;

    const goals = await prisma.goal.findMany({
      where,
      orderBy: { endDate: 'asc' },
      include: { milestones: { orderBy: { sortOrder: 'asc' }, take: 3 } },
    });

    const typeLabel: Record<string, string> = { MONTHLY: '月度', QUARTERLY: '季度', YEARLY: '年度' };
    const statusLabel: Record<string, string> = { ACTIVE: '进行中', COMPLETED: '已完成', ABANDONED: '已放弃', AT_RISK: '有风险' };

    return {
      meta: { tool: 'list_goals', total: goals.length },
      highlights: {
        total: goals.length,
        active: goals.filter(g => g.status === 'ACTIVE').length,
        atRisk: goals.filter(g => g.status === 'AT_RISK').length,
      },
      summary: `${goals.length} 个目标（${goals.filter(g => g.status === 'ACTIVE').length} 进行中, ${goals.filter(g => g.status === 'AT_RISK').length} 有风险）`,
      data: goals.map(g => ({
        id: g.id,
        title: g.title,
        type: typeLabel[g.type] || g.type,
        status: statusLabel[g.status] || g.status,
        target: g.targetValue,
        current: g.currentValue,
        unit: g.unit,
        percent: g.targetValue ? `${Math.round((g.currentValue / g.targetValue) * 100)}%` : '-',
        endDate: g.endDate.toISOString().split('T')[0],
        milestones: g.milestones.map(m => ({ title: m.title, completed: m.completed })),
      })),
    };
  },
};

export const getGoalOverviewTool: ToolDefinition = {
  name: 'get_goal_overview',
  description: `目标总览：各类型目标完成情况，含风险预警。

使用时机:
- "目标总览"、"目标整体情况"
- "目标完成得怎么样"、"目标风险"

不使用时机:
- 单个目标详情 → 用 get_goal_progress
- 目标列表 → 用 list_goals

返回数据: byType/overall/atRiskGoals/completedGoals`,
  category: 'goal',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {},
  },
  handler: async (_args, userId) => {
    const goals = await prisma.goal.findMany({ where: { userId } });

    const byType = ['MONTHLY', 'QUARTERLY', 'YEARLY'].map(type => {
      const typed = goals.filter(g => g.type === type);
      const avgProgress = typed.length > 0
        ? Math.round(typed.reduce((s, g) => s + (g.targetValue ? (g.currentValue / g.targetValue) * 100 : 0), 0) / typed.length)
        : 0;
      return { type, count: typed.length, avgProgress: `${avgProgress}%` };
    });

    const atRisk = goals.filter(g => g.status === 'AT_RISK' || (g.targetValue && g.currentValue / g.targetValue < 0.3));
    const completed = goals.filter(g => g.status === 'COMPLETED');

    return {
      meta: { tool: 'get_goal_overview', totalGoals: goals.length },
      highlights: {
        total: goals.length,
        completed: completed.length,
        atRisk: atRisk.length,
      },
      summary: `${goals.length} 个目标，${completed.length} 已完成，${atRisk.length} 有风险`,
      data: {
        byType,
        completedGoals: completed.length,
        atRiskGoals: atRisk.map(g => ({
          title: g.title,
          type: g.type,
          progress: g.targetValue ? `${Math.round((g.currentValue / g.targetValue) * 100)}%` : '0%',
          endDate: g.endDate.toISOString().split('T')[0],
        })),
      },
    };
  },
};

export const createGoalTool: ToolDefinition = {
  name: 'create_goal',
  description: '创建目标（月度/季度/年度）。支持设置目标值、类型、指标类型、关联项目/客户。用户说"创建目标""设定XX目标"时调用。写操作需确认。',
  category: 'goal',
  access: 'write',
  requiresConfirmation: true,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: '目标标题' },
      type: { type: 'string', enum: ['MONTHLY', 'QUARTERLY', 'YEARLY'], description: '目标类型' },
      metricType: { type: 'string', enum: ['REVENUE', 'PROJECT_COUNT', 'CLIENT_COUNT', 'HOURS', 'PERCENTAGE', 'MILESTONE'], description: '指标类型' },
      targetValue: { type: 'number', description: '目标值' },
      unit: { type: 'string', description: '单位：元/个/%/小时' },
      startDate: { type: 'string', description: '开始日期 YYYY-MM-DD' },
      endDate: { type: 'string', description: '结束日期 YYYY-MM-DD' },
      description: { type: 'string', description: '目标描述' },
      projectName: { type: 'string', description: '关联项目名' },
    },
    required: ['title', 'type', 'startDate', 'endDate'],
  },
  handler: async (args, userId) => {
    let projectId: string | undefined;
    if (args.projectName) {
      const project = await prisma.project.findFirst({ where: { ownerId: userId, name: { contains: args.projectName as string } } });
      if (project) projectId = project.id;
    }

    const goal = await prisma.goal.create({
      data: {
        userId,
        title: args.title as string,
        type: args.type as string,
        metricType: (args.metricType as string) || 'MILESTONE',
        targetValue: args.targetValue ? Number(args.targetValue) : null,
        currentValue: 0,
        unit: (args.unit as string) || null,
        startDate: new Date(args.startDate as string),
        endDate: new Date(args.endDate as string),
        description: (args.description as string) || null,
        projectId,
        status: 'ACTIVE',
      },
    });

    const typeLabel: Record<string, string> = { MONTHLY: '月度', QUARTERLY: '季度', YEARLY: '年度' };
    return {
      success: true,
      action: '创建目标',
      summary: `已创建${typeLabel[goal.type] || ''}目标「${goal.title}」${goal.targetValue ? `，目标值 ${goal.targetValue}${goal.unit || ''}` : ''}`,
      details: {
        标题: goal.title,
        类型: typeLabel[goal.type] || goal.type,
        目标值: goal.targetValue ? `${goal.targetValue}${goal.unit || ''}` : '里程碑',
        截止: goal.endDate.toISOString().split('T')[0],
      },
    };
  },
};

export const updateGoalTool: ToolDefinition = {
  name: 'update_goal',
  description: '更新目标信息（标题、状态、目标值、截止日期等）。用户说"修改目标""更新XX目标"时调用。写操作需确认。',
  category: 'goal',
  access: 'write',
  requiresConfirmation: true,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      goalId: { type: 'string', description: '目标 ID' },
      title: { type: 'string', description: '新标题' },
      status: { type: 'string', enum: ['ACTIVE', 'COMPLETED', 'ABANDONED', 'AT_RISK'] },
      targetValue: { type: 'number', description: '新目标值' },
      endDate: { type: 'string', description: '新截止日期 YYYY-MM-DD' },
      description: { type: 'string', description: '新描述' },
    },
    required: ['goalId'],
  },
  handler: async (args, userId) => {
    const existing = await prisma.goal.findFirst({ where: { id: args.goalId as string, userId } });
    if (!existing) return { error: '未找到该目标' };

    const data: Record<string, unknown> = {};
    if (args.title) data.title = args.title;
    if (args.status) data.status = args.status;
    if (args.targetValue != null) data.targetValue = Number(args.targetValue);
    if (args.endDate) data.endDate = new Date(args.endDate as string);
    if (args.description !== undefined) data.description = args.description;

    const updated = await prisma.goal.update({ where: { id: existing.id }, data });
    return {
      success: true,
      action: '更新目标',
      summary: `已更新目标「${updated.title}」`,
      details: { 标题: updated.title, 状态: updated.status },
    };
  },
};

export const updateGoalProgressTool: ToolDefinition = {
  name: 'update_goal_progress',
  description: '更新目标进度值（增量或设置）。支持记录进度日志。用户说"目标进度更新到XX""完成XX"时调用。写操作需确认。',
  category: 'goal',
  access: 'write',
  requiresConfirmation: true,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      goalId: { type: 'string', description: '目标 ID' },
      goalTitle: { type: 'string', description: '目标标题，模糊匹配' },
      value: { type: 'number', description: '进度值（增量，正数=增加）' },
      absoluteValue: { type: 'number', description: '进度值（绝对值，直接设置为该值）' },
      note: { type: 'string', description: '进度变更说明' },
    },
    required: [],
  },
  handler: async (args, userId) => {
    let goalId = args.goalId as string | undefined;
    if (!goalId && args.goalTitle) {
      const goal = await prisma.goal.findFirst({ where: { userId, title: { contains: args.goalTitle as string }, status: 'ACTIVE' } });
      if (goal) goalId = goal.id;
    }
    if (!goalId) return { error: '请指定目标' };

    const goal = await prisma.goal.findFirst({ where: { id: goalId, userId } });
    if (!goal) return { error: '未找到该目标' };

    let newValue: number;
    if (args.absoluteValue != null) {
      newValue = Number(args.absoluteValue);
    } else if (args.value != null) {
      newValue = goal.currentValue + Number(args.value);
    } else {
      return { error: '请提供 value 或 absoluteValue' };
    }

    await prisma.goal.update({ where: { id: goal.id }, data: { currentValue: newValue } });

    // 记录进度日志
    await prisma.goalProgressLog.create({
      data: {
        goalId: goal.id,
        userId,
        value: args.value != null ? Number(args.value) : newValue - goal.currentValue,
        note: (args.note as string) || null,
        date: new Date(),
      },
    });

    const percent = goal.targetValue ? Math.round((newValue / goal.targetValue) * 100) : 0;
    return {
      success: true,
      action: '更新目标进度',
      summary: `目标「${goal.title}」进度更新为 ${newValue}${goal.unit || ''}（${percent}%）`,
      details: {
        目标: goal.title,
        当前值: `${newValue}${goal.unit || ''}`,
        目标值: goal.targetValue ? `${goal.targetValue}${goal.unit || ''}` : '-',
        完成度: `${percent}%`,
      },
    };
  },
};
