import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const createPaymentTool: ToolDefinition = {
  name: 'create_payment',
  description: '录入项目收款（首付/进度款/尾款/调整），自动创建关联收入流水。'
    + '用户说"收到XX的款""录入回款""XX项目收到XX元"时调用。写操作需确认。',
  category: 'payment',
  access: 'write',
  requiresConfirmation: true,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      amount: { type: 'number', description: '金额（元），如 5000 表示 ¥5,000' },
      type: { type: 'string', enum: ['DOWN_PAYMENT', 'PROGRESS', 'FINAL', 'ADJUSTMENT', 'OTHER'], description: '回款类型' },
      method: { type: 'string', enum: ['BANK_TRANSFER', 'ALIPAY', 'WECHAT', 'CASH', 'OTHER'], default: 'BANK_TRANSFER', description: '收款方式' },
      projectId: { type: 'string', description: '项目 ID' },
      projectName: { type: 'string', description: '项目名，模糊匹配' },
      receivedAt: { type: 'string', description: '到账日期 YYYY-MM-DD，默认今天' },
      note: { type: 'string', description: '备注' },
    },
    required: ['amount'],
  },
  handler: async (args, userId) => {
    const amount = Math.round((args.amount as number) * 100);
    if (amount <= 0) return { error: '金额必须大于 0' };

    let projectId = args.projectId as string | undefined;
    if (!projectId && args.projectName) {
      const project = await prisma.project.findFirst({ where: { ownerId: userId, name: { contains: args.projectName as string } } });
      if (project) projectId = project.id;
    }
    if (!projectId) return { error: '请指定项目' };

    const project = await prisma.project.findFirst({ where: { id: projectId, ownerId: userId } });
    if (!project) return { error: '项目不存在或无权访问' };

    const { payment, transaction: txn } = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          amount,
          type: (args.type as string) || 'OTHER',
          method: (args.method as string) || 'BANK_TRANSFER',
          receivedAt: args.receivedAt ? new Date(args.receivedAt as string) : new Date(),
          note: (args.note as string) || null,
          projectId,
        },
      });
      const t = await tx.transaction.create({
        data: {
          userId,
          amount,
          direction: 'INCOME',
          category: 'PROJECT_PAYMENT',
          description: `项目收款 - ${project.name}`,
          date: p.receivedAt,
          source: 'PAYMENT',
          paymentId: p.id,
          projectId,
        },
      });
      return { payment: p, transaction: t };
    });

    const typeLabel: Record<string, string> = { DOWN_PAYMENT: '首付款', PROGRESS: '进度款', FINAL: '尾款', ADJUSTMENT: '调整款', OTHER: '其他' };
    return {
      success: true,
      action: '录入收款',
      summary: `已记录项目「${project.name}」${typeLabel[payment.type] || '收款'} ¥${args.amount}，已自动创建收入流水`,
      details: {
        金额: `¥${args.amount}`,
        类型: typeLabel[payment.type] || payment.type,
        项目: project.name,
        到账: payment.receivedAt.toISOString().split('T')[0],
      },
    };
  },
};

export const listPaymentsTool: ToolDefinition = {
  name: 'list_payments',
  description: `查询收款记录。支持按项目筛选。

使用时机:
- "查一下收款记录"、"XX项目的回款情况"
- "收了多少钱"、"收款明细"

不使用时机:
- 应收账款汇总 → 用 get_receivables
- 账龄分析 → 用 get_aging_analysis
- 查看所有流水 → 用 list_transactions

返回数据: 收款列表含 amount/type/method/receivedAt/projectName`,
  category: 'payment',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: '按项目筛选' },
      projectName: { type: 'string', description: '项目名，模糊匹配' },
      limit: { type: 'number', description: '返回条数，默认 20' },
    },
  },
  handler: async (args, userId) => {
    const where: Record<string, unknown> = {};

    let projectId = args.projectId as string | undefined;
    if (!projectId && args.projectName) {
      const project = await prisma.project.findFirst({ where: { ownerId: userId, name: { contains: args.projectName as string } } });
      if (project) projectId = project.id;
    }
    if (projectId) where.projectId = projectId;
    else {
      // 限制只查用户自己的项目
      const userProjects = await prisma.project.findMany({ where: { ownerId: userId }, select: { id: true } });
      where.projectId = { in: userProjects.map(p => p.id) };
    }

    const limit = (args.limit as number) || 20;
    const payments = await prisma.payment.findMany({
      where,
      take: limit,
      orderBy: { receivedAt: 'desc' },
      include: { project: { select: { name: true } } },
    });

    const total = payments.reduce((s, p) => s + p.amount, 0);
    const typeLabel: Record<string, string> = { DOWN_PAYMENT: '首付', PROGRESS: '进度款', FINAL: '尾款', ADJUSTMENT: '调整', OTHER: '其他' };

    return {
      meta: { tool: 'list_payments', total: payments.length },
      highlights: { totalReceived: total / 100, paymentCount: payments.length },
      summary: `${payments.length} 笔收款记录，合计 ¥${(total / 100).toFixed(2)}`,
      data: payments.map(p => ({
        id: p.id,
        amount: p.amount / 100,
        type: typeLabel[p.type] || p.type,
        method: p.method,
        receivedAt: p.receivedAt.toISOString().split('T')[0],
        project: p.project?.name,
        note: p.note,
      })),
    };
  },
};

export const getReceivablesTool: ToolDefinition = {
  name: 'get_receivables',
  description: `应收账款汇总：总额/已收/待收/回款率。支持按项目筛选。

使用时机:
- "应收多少"、"还有多少没收到"、"回款率"
- "XX项目收了多少了"

不使用时机:
- 收款明细 → 用 list_payments
- 账龄分析 → 用 get_aging_analysis
- 利润分析 → 用 get_profit_analysis

返回数据: totalBudget/totalReceived/remaining/collectionRate/projects`,
  category: 'payment',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: '按项目筛选' },
    },
  },
  handler: async (args, userId) => {
    const projectWhere: Record<string, unknown> = { ownerId: userId, status: { in: ['ACTIVE', 'COMPLETED'] } };
    if (args.projectId) projectWhere.id = args.projectId;

    const projects = await prisma.project.findMany({
      where: projectWhere,
      include: { customer: { select: { name: true } } },
    });

    const projectIds = projects.map(p => p.id);

    const paymentAggs = projectIds.length > 0
      ? await prisma.payment.groupBy({ by: ['projectId'], where: { projectId: { in: projectIds } }, _sum: { amount: true } })
      : [];
    const paymentMap = new Map(paymentAggs.map(a => [a.projectId, a._sum.amount || 0]));

    const projectData = projects.map(p => {
      const budget = p.budget || 0;
      const received = paymentMap.get(p.id) || 0;
      return {
        name: p.name,
        customer: p.customer?.name || '未关联',
        budget: budget / 100,
        received: received / 100,
        remaining: (budget - received) / 100,
        rate: budget > 0 ? `${Math.round((received / budget) * 100)}%` : '-',
      };
    });

    const totalBudget = projectData.reduce((s, p) => s + p.budget, 0);
    const totalReceived = projectData.reduce((s, p) => s + p.received, 0);
    const remaining = totalBudget - totalReceived;

    return {
      meta: { tool: 'get_receivables', projectCount: projects.length },
      highlights: {
        totalBudget,
        totalReceived,
        remaining,
        collectionRate: totalBudget > 0 ? `${Math.round((totalReceived / totalBudget) * 100)}%` : '-',
      },
      summary: `总预算 ¥${totalBudget}，已收 ¥${totalReceived}，待收 ¥${remaining}，回款率 ${totalBudget > 0 ? Math.round((totalReceived / totalBudget) * 100) : 0}%`,
      data: projectData,
    };
  },
};

export const getAgingAnalysisTool: ToolDefinition = {
  name: 'get_aging_analysis',
  description: `账龄分析：按到账日期分段统计应收款项（0-30/31-60/61-90/90+ 天）。

使用时机:
- "账龄分析"、"哪些款逾期了"、"欠款多久了"
- "应收账龄"

不使用时机:
- 应收账款汇总 → 用 get_receivables
- 收款明细 → 用 list_payments

返回数据: 各账龄段金额和占比`,
  category: 'payment',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {},
  },
  handler: async (_args, userId) => {
    const projects = await prisma.project.findMany({
      where: { ownerId: userId, status: { in: ['ACTIVE', 'COMPLETED'] } },
      select: { id: true, name: true, budget: true, startDate: true },
    });

    const projectIds = projects.map(p => p.id);
    const paymentAggs = projectIds.length > 0
      ? await prisma.payment.groupBy({ by: ['projectId'], where: { projectId: { in: projectIds } }, _sum: { amount: true } })
      : [];
    const paymentMap = new Map(paymentAggs.map(a => [a.projectId, a._sum.amount || 0]));

    const now = new Date();
    const buckets = { '0-30天': 0, '31-60天': 0, '61-90天': 0, '90天以上': 0 };

    for (const p of projects) {
      const budget = p.budget || 0;
      const received = paymentMap.get(p.id) || 0;
      const remaining = budget - received;
      if (remaining <= 0) continue;

      const daysSinceStart = Math.floor((now.getTime() - p.startDate.getTime()) / 86400000);
      if (daysSinceStart <= 30) buckets['0-30天'] += remaining;
      else if (daysSinceStart <= 60) buckets['31-60天'] += remaining;
      else if (daysSinceStart <= 90) buckets['61-90天'] += remaining;
      else buckets['90天以上'] += remaining;
    }

    const total = Object.values(buckets).reduce((s, v) => s + v, 0);
    const data = Object.entries(buckets).map(([range, amount]) => ({
      range,
      amount: amount / 100,
      percent: total > 0 ? `${Math.round((amount / total) * 100)}%` : '0%',
    }));

    return {
      meta: { tool: 'get_aging_analysis', projectCount: projects.length },
      highlights: { totalReceivable: total / 100 },
      summary: `应收总额 ¥${(total / 100).toFixed(2)}，其中 90 天以上 ¥${(buckets['90天以上'] / 100).toFixed(2)}`,
      data,
    };
  },
};
