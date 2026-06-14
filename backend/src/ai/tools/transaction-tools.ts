import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const listTransactionsTool: ToolDefinition = {
  name: 'list_transactions',
  description: `查询收支流水记录。支持按方向（收入/支出）、类别、项目、日期范围筛选。

使用时机:
- "查一下最近的流水"、"这个月有哪些支出"
- "收入记录"、"支出明细"、"记账记录"

不使用时机:
- 查看现金流趋势 → 用 get_cash_flow
- 查看成本明细 → 用 get_cost_breakdown
- 录入新的流水 → 用 create_transaction

返回数据: 流水列表含 amount/direction/category/date/projectName，支持 page/limit 参数`,
  category: 'transaction',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      direction: { type: 'string', enum: ['INCOME', 'EXPENSE'], description: '筛选方向：收入或支出' },
      category: { type: 'string', description: '筛选类别，如 PROJECT_PAYMENT/RENT/SUBSCRIPTION 等' },
      projectId: { type: 'string', description: '按项目筛选' },
      startDate: { type: 'string', description: '开始日期 YYYY-MM-DD' },
      endDate: { type: 'string', description: '结束日期 YYYY-MM-DD' },
      limit: { type: 'number', description: '返回条数，默认 20' },
    },
  },
  handler: async (args, userId) => {
    const where: Record<string, unknown> = { userId };
    if (args.direction) where.direction = args.direction;
    if (args.category) where.category = args.category;
    if (args.projectId) where.projectId = args.projectId;
    if (args.startDate || args.endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (args.startDate) dateFilter.gte = new Date(args.startDate as string);
      if (args.endDate) dateFilter.lte = new Date(args.endDate as string);
      where.date = dateFilter;
    }

    const limit = (args.limit as number) || 20;
    const data = await prisma.transaction.findMany({
      where,
      take: limit,
      orderBy: { date: 'desc' },
      include: { project: { select: { name: true } } },
    });

    const totalIncome = data.filter(t => t.direction === 'INCOME').reduce((s, t) => s + t.amount, 0);
    const totalExpense = data.filter(t => t.direction === 'EXPENSE').reduce((s, t) => s + t.amount, 0);

    return {
      meta: { tool: 'list_transactions', total: data.length, direction: args.direction || '全部' },
      highlights: {
        totalIncome: totalIncome / 100,
        totalExpense: totalExpense / 100,
        net: (totalIncome - totalExpense) / 100,
      },
      summary: `${data.length} 笔流水，收入 ¥${(totalIncome / 100).toFixed(2)}，支出 ¥${(totalExpense / 100).toFixed(2)}，净额 ¥${((totalIncome - totalExpense) / 100).toFixed(2)}`,
      data: data.map(t => ({
        id: t.id,
        amount: t.amount / 100,
        direction: t.direction,
        category: t.category,
        description: t.description,
        date: t.date.toISOString().split('T')[0],
        source: t.source,
        project: t.project?.name || null,
        note: t.note,
      })),
    };
  },
};

export const createTransactionTool: ToolDefinition = {
  name: 'create_transaction',
  description: '录入收入或支出流水。支持设置金额（元）、方向（收入/支出）、类别、关联项目、日期。'
    + '用户说"记一笔支出""收入XX元""记录流水"时调用。没说日期默认今天。写操作需确认。',
  category: 'transaction',
  access: 'write',
  requiresConfirmation: true,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      amount: { type: 'number', description: '金额（元），如 500 表示 ¥500' },
      direction: { type: 'string', enum: ['INCOME', 'EXPENSE'], description: '收入或支出' },
      category: { type: 'string', description: '类别：收入类 PROJECT_PAYMENT/FREELANCE/OTHER_INCOME，支出类 RENT/SUBSCRIPTION/EQUIPMENT/OTHER_EXPENSE 等' },
      description: { type: 'string', description: '流水描述' },
      date: { type: 'string', description: '日期 YYYY-MM-DD，默认今天' },
      projectId: { type: 'string', description: '关联项目 ID' },
      projectName: { type: 'string', description: '关联项目名，模糊匹配' },
      note: { type: 'string', description: '备注' },
    },
    required: ['amount', 'direction'],
  },
  handler: async (args, userId) => {
    const amount = Math.round((args.amount as number) * 100);
    if (amount <= 0) return { error: '金额必须大于 0' };

    let projectId = args.projectId as string | undefined;
    if (!projectId && args.projectName) {
      const project = await prisma.project.findFirst({ where: { ownerId: userId, name: { contains: args.projectName as string } } });
      if (project) projectId = project.id;
    }

    const txn = await prisma.transaction.create({
      data: {
        userId,
        amount,
        direction: args.direction as string,
        category: (args.category as string) || 'OTHER_EXPENSE',
        description: (args.description as string) || `${args.direction === 'INCOME' ? '收入' : '支出'} ¥${args.amount}`,
        date: args.date ? new Date(args.date as string) : new Date(),
        source: 'MANUAL',
        projectId,
        note: (args.note as string) || null,
      },
    });

    return {
      success: true,
      action: '录入流水',
      summary: `已记录${args.direction === 'INCOME' ? '收入' : '支出'} ¥${args.amount}`,
      details: {
        金额: `¥${args.amount}`,
        方向: args.direction === 'INCOME' ? '收入' : '支出',
        类别: args.category || '其他',
        日期: txn.date.toISOString().split('T')[0],
      },
    };
  },
};

export const updateTransactionTool: ToolDefinition = {
  name: 'update_transaction',
  description: '编辑手动录入的流水。支持修改金额、类别、描述、日期、备注。'
    + '用户说"修改流水""改一下那笔支出"时调用。写操作需确认。',
  category: 'transaction',
  access: 'write',
  requiresConfirmation: true,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      transactionId: { type: 'string', description: '流水 ID' },
      amount: { type: 'number', description: '新金额（元）' },
      category: { type: 'string', description: '新类别' },
      description: { type: 'string', description: '新描述' },
      date: { type: 'string', description: '新日期 YYYY-MM-DD' },
      note: { type: 'string', description: '新备注' },
    },
    required: ['transactionId'],
  },
  handler: async (args, userId) => {
    const existing = await prisma.transaction.findFirst({ where: { id: args.transactionId as string, userId } });
    if (!existing) return { error: '未找到该流水记录' };
    if (existing.source !== 'MANUAL') return { error: '只能编辑手动录入的流水' };

    const data: Record<string, unknown> = {};
    if (args.amount != null) data.amount = Math.round((args.amount as number) * 100);
    if (args.category) data.category = args.category;
    if (args.description) data.description = args.description;
    if (args.date) data.date = new Date(args.date as string);
    if (args.note !== undefined) data.note = args.note;

    const updated = await prisma.transaction.update({ where: { id: existing.id }, data });
    return {
      success: true,
      action: '更新流水',
      summary: `已更新流水 ¥${updated.amount / 100}`,
      details: { 金额: `¥${updated.amount / 100}`, 描述: updated.description },
    };
  },
};

export const deleteTransactionTool: ToolDefinition = {
  name: 'delete_transaction',
  description: '删除手动录入的流水。不可恢复，系统自动创建的流水（来自回款/订阅）不能删除。写操作需确认。',
  category: 'transaction',
  access: 'write',
  requiresConfirmation: true,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      transactionId: { type: 'string', description: '流水 ID' },
    },
    required: ['transactionId'],
  },
  handler: async (args, userId) => {
    const existing = await prisma.transaction.findFirst({ where: { id: args.transactionId as string, userId } });
    if (!existing) return { error: '未找到该流水记录' };
    if (existing.source !== 'MANUAL') return { error: '只能删除手动录入的流水' };

    await prisma.transaction.delete({ where: { id: existing.id } });
    return {
      success: true,
      action: '删除流水',
      summary: `已删除流水「${existing.description}」 ¥${existing.amount / 100}`,
      details: {},
    };
  },
};
