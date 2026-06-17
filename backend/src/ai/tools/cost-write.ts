import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const createCostTool: ToolDefinition = {
  name: 'create_cost',
  description: '录入项目成本（人工/材料/管理/其他）。用户说"记一笔成本""花了XX元""项目成本XX"时调用。写操作需确认。',
  category: 'finance',
  access: 'write',
  requiresConfirmation: true,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      amount: { type: 'number', description: '金额（元），如 500 表示 ¥500' },
      category: { type: 'string', enum: ['LABOR', 'MATERIAL', 'OVERHEAD', 'OTHER'], description: '成本类别' },
      description: { type: 'string', description: '成本说明' },
      date: { type: 'string', description: '日期 YYYY-MM-DD，默认今天' },
      projectId: { type: 'string', description: '项目 ID' },
      projectName: { type: 'string', description: '项目名，模糊匹配' },
      taskTitle: { type: 'string', description: '关联任务标题，模糊匹配' },
    },
    required: ['amount', 'description'],
  },
  handler: async (args, userId) => {
    const amount = Math.round((args.amount as number) * 100);
    if (amount <= 0) return { error: '金额必须大于 0' };

    let projectId = args.projectId as string | undefined;
    if (!projectId && args.projectName) {
      const project = await prisma.project.findFirst({ where: { ownerId: userId, name: { contains: args.projectName as string } } });
      if (project) projectId = project.id;
    }
    if (!projectId) {
      const project = await prisma.project.findFirst({ where: { ownerId: userId, status: 'ACTIVE' } });
      if (project) projectId = project.id;
    }
    if (!projectId) return { error: '请指定项目' };

    let taskId: string | undefined;
    if (args.taskTitle && projectId) {
      const task = await prisma.task.findFirst({ where: { projectId, title: { contains: args.taskTitle as string } } });
      if (task) taskId = task.id;
    }

    const cost = await prisma.costRecord.create({
      data: {
        amount,
        category: (args.category as string) || 'OTHER',
        description: args.description as string,
        date: args.date ? new Date(args.date as string) : new Date(),
        projectId,
        taskId,
      },
    });

    const categoryLabel: Record<string, string> = { LABOR: '人工', MATERIAL: '材料', OVERHEAD: '管理', OTHER: '其他' };
    return {
      success: true,
      action: '录入成本',
      summary: `已记录 ${categoryLabel[cost.category] || '其他'}成本 ¥${args.amount}`,
      details: {
        金额: `¥${args.amount}`,
        类别: categoryLabel[cost.category] || cost.category,
        描述: cost.description,
        日期: cost.date.toISOString().split('T')[0],
      },
    };
  },
};

export const deleteCostTool: ToolDefinition = {
  name: 'delete_cost',
  description: `删除成本记录。不可恢复。

使用时机:
- "删掉那笔成本"、"删除成本记录"

不使用时机:
- 只想修改金额或类别 → 请联系前端编辑（AI 暂不支持更新成本）`,
  category: 'finance',
  access: 'write',
  requiresConfirmation: true,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      costId: { type: 'string', description: '成本记录 ID' },
    },
    required: ['costId'],
  },
  handler: async (args, userId) => {
    const existing = await prisma.costRecord.findFirst({
      where: { id: args.costId as string, project: { ownerId: userId } },
    });
    if (!existing) return { error: '未找到该成本记录' };

    await prisma.costRecord.delete({ where: { id: existing.id } });
    return {
      success: true,
      action: '删除成本',
      summary: `已删除成本「${existing.description}」 ¥${existing.amount / 100}`,
      details: {},
    };
  },
};
