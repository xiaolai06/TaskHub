import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const listSubscriptionsTool: ToolDefinition = {
  name: 'list_subscriptions',
  description: `订阅列表，支持状态筛选。

使用时机:
- "查看订阅"、"有哪些订阅"、"订阅服务"
- "SaaS 费用"

不使用时机:
- 订阅费用汇总 → 用 get_subscription_cost
- 创建订阅 → 用 create_subscription

返回数据: 订阅列表含 name/amount/cycle/status/nextBillingAt`,
  category: 'subscription',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['ACTIVE', 'PAUSED', 'CANCELLED'], description: '筛选状态' },
    },
  },
  handler: async (args, userId) => {
    const where: Record<string, unknown> = { userId };
    if (args.status) where.status = args.status;

    const subs = await prisma.subscription.findMany({
      where,
      orderBy: { nextBillingAt: 'asc' },
    });

    const cycleLabel: Record<string, string> = { MONTHLY: '月付', QUARTERLY: '季付', YEARLY: '年付' };
    const statusLabel: Record<string, string> = { ACTIVE: '活跃', PAUSED: '暂停', CANCELLED: '已取消' };

    return {
      meta: { tool: 'list_subscriptions', total: subs.length },
      highlights: {
        total: subs.length,
        active: subs.filter(s => s.status === 'ACTIVE').length,
        monthlyCost: subs.filter(s => s.status === 'ACTIVE').reduce((s, sub) => {
          const monthly = sub.cycle === 'YEARLY' ? sub.amount / 12 : sub.cycle === 'QUARTERLY' ? sub.amount / 3 : sub.amount;
          return s + monthly;
        }, 0) / 100,
      },
      summary: `${subs.length} 个订阅（${subs.filter(s => s.status === 'ACTIVE').length} 个活跃）`,
      data: subs.map(s => ({
        id: s.id,
        name: s.name,
        category: s.category,
        amount: s.amount / 100,
        currency: s.currency,
        cycle: cycleLabel[s.cycle] || s.cycle,
        status: statusLabel[s.status] || s.status,
        nextBillingAt: s.nextBillingAt.toISOString().split('T')[0],
      })),
    };
  },
};

export const getSubscriptionCostTool: ToolDefinition = {
  name: 'get_subscription_cost',
  description: `订阅费用汇总：月度/年度总费用，按类别分布。

使用时机:
- "订阅花多少钱"、"SaaS 费用"、"每月订阅支出"
- "订阅成本"

不使用时机:
- 订阅列表 → 用 list_subscriptions
- 成本分析 → 用 get_cost_breakdown

返回数据: monthlyTotal/yearlyTotal/byCategory/top3`,
  category: 'subscription',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {},
  },
  handler: async (_args, userId) => {
    const subs = await prisma.subscription.findMany({ where: { userId, status: 'ACTIVE' } });

    let monthlyTotal = 0;
    for (const s of subs) {
      const monthly = s.cycle === 'YEARLY' ? s.amount / 12 : s.cycle === 'QUARTERLY' ? s.amount / 3 : s.amount;
      monthlyTotal += monthly;
    }
    const yearlyTotal = monthlyTotal * 12;

    // 按类别聚合
    const byCategory = new Map<string, number>();
    for (const s of subs) {
      const monthly = s.cycle === 'YEARLY' ? s.amount / 12 : s.cycle === 'QUARTERLY' ? s.amount / 3 : s.amount;
      byCategory.set(s.category, (byCategory.get(s.category) || 0) + monthly);
    }

    return {
      meta: { tool: 'get_subscription_cost', activeCount: subs.length },
      highlights: { monthlyTotal: Math.round(monthlyTotal) / 100, yearlyTotal: Math.round(yearlyTotal) / 100 },
      summary: `${subs.length} 个活跃订阅，月均 ¥${(Math.round(monthlyTotal) / 100).toFixed(2)}，年均 ¥${(Math.round(yearlyTotal) / 100).toFixed(2)}`,
      data: {
        monthlyTotal: Math.round(monthlyTotal) / 100,
        yearlyTotal: Math.round(yearlyTotal) / 100,
        byCategory: [...byCategory.entries()]
          .map(([category, amount]) => ({ category, monthlyAmount: Math.round(amount) / 100 }))
          .sort((a, b) => b.monthlyAmount - a.monthlyAmount),
        top3: subs
          .map(s => ({ name: s.name, monthly: Math.round(s.cycle === 'YEARLY' ? s.amount / 12 : s.cycle === 'QUARTERLY' ? s.amount / 3 : s.amount) / 100 }))
          .sort((a, b) => b.monthly - a.monthly)
          .slice(0, 3),
      },
    };
  },
};

export const createSubscriptionTool: ToolDefinition = {
  name: 'create_subscription',
  description: '创建订阅。用户说"添加订阅""记录XX订阅"时调用。写操作需确认。',
  category: 'subscription',
  access: 'write',
  requiresConfirmation: true,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '服务名称' },
      category: { type: 'string', enum: ['SOFTWARE', 'CLOUD', 'DOMAIN', 'TOOL', 'MEDIA', 'OTHER'], description: '类别' },
      amount: { type: 'number', description: '每期金额（元）' },
      currency: { type: 'string', enum: ['CNY', 'USD', 'EUR'], default: 'CNY', description: '货币' },
      cycle: { type: 'string', enum: ['MONTHLY', 'QUARTERLY', 'YEARLY'], description: '付费周期' },
      startDate: { type: 'string', description: '首次订阅日期 YYYY-MM-DD' },
      url: { type: 'string', description: '服务网址' },
      note: { type: 'string', description: '备注' },
    },
    required: ['name', 'amount', 'cycle'],
  },
  handler: async (args, userId) => {
    const amount = Math.round((args.amount as number) * 100);
    const startDate = args.startDate ? new Date(args.startDate as string) : new Date();

    // 计算下次扣费日
    const nextBillingAt = new Date(startDate);
    if (args.cycle === 'MONTHLY') nextBillingAt.setMonth(nextBillingAt.getMonth() + 1);
    else if (args.cycle === 'QUARTERLY') nextBillingAt.setMonth(nextBillingAt.getMonth() + 3);
    else nextBillingAt.setFullYear(nextBillingAt.getFullYear() + 1);

    const sub = await prisma.subscription.create({
      data: {
        userId,
        name: args.name as string,
        category: (args.category as string) || 'OTHER',
        amount,
        currency: (args.currency as string) || 'CNY',
        cycle: args.cycle as string,
        startDate,
        nextBillingAt,
        status: 'ACTIVE',
        url: (args.url as string) || null,
        note: (args.note as string) || null,
      },
    });

    const cycleLabel: Record<string, string> = { MONTHLY: '月付', QUARTERLY: '季付', YEARLY: '年付' };
    return {
      success: true,
      action: '创建订阅',
      summary: `已记录订阅「${sub.name}」¥${args.amount}/${cycleLabel[sub.cycle] || sub.cycle}`,
      details: {
        名称: sub.name,
        金额: `¥${args.amount}/${cycleLabel[sub.cycle] || sub.cycle}`,
        下次扣费: sub.nextBillingAt.toISOString().split('T')[0],
      },
    };
  },
};

export const pauseSubscriptionTool: ToolDefinition = {
  name: 'pause_subscription',
  description: '暂停订阅。用户说"暂停XX订阅""先不续费了"时调用。写操作需确认。',
  category: 'subscription',
  access: 'write',
  requiresConfirmation: true,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      subscriptionId: { type: 'string', description: '订阅 ID' },
      name: { type: 'string', description: '订阅名，模糊匹配' },
    },
  },
  handler: async (args, userId) => {
    let subId = args.subscriptionId as string | undefined;
    if (!subId && args.name) {
      const sub = await prisma.subscription.findFirst({ where: { userId, name: { contains: args.name as string } } });
      if (sub) subId = sub.id;
    }
    if (!subId) return { error: '请指定订阅' };

    const sub = await prisma.subscription.findFirst({ where: { id: subId, userId } });
    if (!sub) return { error: '未找到该订阅' };
    if (sub.status !== 'ACTIVE') return { error: '订阅不是活跃状态' };

    await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'PAUSED' } });
    return {
      success: true,
      action: '暂停订阅',
      summary: `已暂停订阅「${sub.name}」`,
      details: { 名称: sub.name, 状态: '已暂停' },
    };
  },
};

export const resumeSubscriptionTool: ToolDefinition = {
  name: 'resume_subscription',
  description: '恢复已暂停的订阅。用户说"恢复订阅""继续续费"时调用。写操作需确认。',
  category: 'subscription',
  access: 'write',
  requiresConfirmation: true,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      subscriptionId: { type: 'string', description: '订阅 ID' },
      name: { type: 'string', description: '订阅名，模糊匹配' },
    },
  },
  handler: async (args, userId) => {
    let subId = args.subscriptionId as string | undefined;
    if (!subId && args.name) {
      const sub = await prisma.subscription.findFirst({ where: { userId, name: { contains: args.name as string } } });
      if (sub) subId = sub.id;
    }
    if (!subId) return { error: '请指定订阅' };

    const sub = await prisma.subscription.findFirst({ where: { id: subId, userId } });
    if (!sub) return { error: '未找到该订阅' };
    if (sub.status !== 'PAUSED') return { error: '订阅不是暂停状态' };

    await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'ACTIVE' } });
    return {
      success: true,
      action: '恢复订阅',
      summary: `已恢复订阅「${sub.name}」`,
      details: { 名称: sub.name, 状态: '活跃' },
    };
  },
};
