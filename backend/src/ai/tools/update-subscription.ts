import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const updateSubscriptionTool: ToolDefinition = {
  name: 'update_subscription',
  description: `更新订阅服务的名称、金额、周期、分类等信息。

使用时机:
- "把ChatGPT订阅改成XX元"
- "更新订阅的扣费周期"
- "修改订阅备注"

不使用时机:
- 暂停订阅 → 用 pause_subscription
- 删除订阅 → 用 delete_subscription
- 新增订阅 → 用 create_subscription`,
  category: 'subscription',
  access: 'write',
  requiresConfirmation: true,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      subscriptionId: { type: 'string', description: '订阅 ID' },
      name: { type: 'string', description: '订阅名称' },
      amount: { type: 'number', description: '每期金额（元）' },
      cycle: { type: 'string', enum: ['MONTHLY', 'QUARTERLY', 'YEARLY'], description: '计费周期' },
      category: { type: 'string', enum: ['SOFTWARE', 'CLOUD', 'DOMAIN', 'TOOL', 'MEDIA', 'OTHER'], description: '分类' },
      url: { type: 'string', description: '服务网址' },
      note: { type: 'string', description: '备注' },
      autoRenew: { type: 'boolean', description: '是否自动续费' },
    },
    required: ['subscriptionId'],
  },
  handler: async (args, userId) => {
    const subId = args.subscriptionId as string;
    const existing = await prisma.subscription.findFirst({ where: { id: subId, userId } });
    if (!existing) return { error: '订阅不存在或无权访问' };

    const data: Record<string, unknown> = {};
    if (args.name) data.name = args.name;
    if (args.amount != null) data.amount = Math.round((args.amount as number) * 100);
    if (args.cycle) data.cycle = args.cycle;
    if (args.category) data.category = args.category;
    if (args.url !== undefined) data.url = args.url || null;
    if (args.note !== undefined) data.note = args.note || null;
    if (args.autoRenew !== undefined) data.autoRenew = args.autoRenew;

    if (Object.keys(data).length === 0) return { error: '未提供任何更新字段' };

    const updated = await prisma.subscription.update({ where: { id: subId }, data });
    return {
      success: true,
      action: '更新订阅',
      summary: `已更新订阅「${updated.name}」`,
      details: {
        名称: updated.name,
        金额: `¥${(updated.amount / 100).toFixed(2)}`,
        周期: updated.cycle,
        状态: updated.status,
      },
    };
  },
};

export const deleteSubscriptionTool: ToolDefinition = {
  name: 'delete_subscription',
  description: `永久删除订阅记录。不会影响已生成的历史流水记录。

使用时机:
- "删除XX订阅"、"取消这个订阅记录"

不使用时机:
- 暂时不用但保留记录 → 用 pause_subscription`,
  category: 'subscription',
  access: 'write',
  requiresConfirmation: true,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      subscriptionId: { type: 'string', description: '订阅 ID' },
      name: { type: 'string', description: '订阅名称，模糊匹配' },
    },
    required: [],
  },
  handler: async (args, userId) => {
    let subId = args.subscriptionId as string | undefined;
    if (!subId && args.name) {
      const sub = await prisma.subscription.findFirst({ where: { userId, name: { contains: args.name as string } } });
      if (!sub) return { error: `未找到订阅「${args.name}」` };
      subId = sub.id;
    }
    if (!subId) return { error: '请提供订阅 ID 或名称' };

    const existing = await prisma.subscription.findFirst({ where: { id: subId, userId } });
    if (!existing) return { error: '订阅不存在或无权访问' };

    await prisma.subscription.delete({ where: { id: subId } });
    return {
      success: true,
      action: '删除订阅',
      summary: `已删除订阅「${existing.name}」`,
      details: { 名称: existing.name, 金额: `¥${(existing.amount / 100).toFixed(2)}` },
    };
  },
};
