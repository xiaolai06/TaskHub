import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const listCustomersTool: ToolDefinition = {
  name: 'list_customers',
  description: `客户列表，支持状态筛选。

使用时机:
- "查看客户"、"客户列表"、"有哪些客户"
- "VIP 客户"、"活跃客户"

不使用时机:
- 客户跟进提醒 → 用 get_client_follow_up
- 客户详情 → 用 get_client_insights
- 客户排名 → 用 get_client_ranking

返回数据: 客户列表含 name/company/status/industry/lastContact`,
  category: 'client',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['ACTIVE', 'VIP', 'INACTIVE', 'LEAD'], description: '筛选状态' },
      limit: { type: 'number', description: '返回条数，默认 20' },
    },
  },
  handler: async (args, userId) => {
    const where: Record<string, unknown> = { userId };
    if (args.status) where.status = args.status;

    const limit = (args.limit as number) || 20;
    const customers = await prisma.customer.findMany({
      where,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        communications: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
        _count: { select: { projects: true } },
      },
    });

    const statusLabel: Record<string, string> = { ACTIVE: '活跃', VIP: 'VIP', INACTIVE: '不活跃', LEAD: '线索' };

    return {
      meta: { tool: 'list_customers', total: customers.length, statusFilter: args.status || '全部' },
      highlights: {
        total: customers.length,
        vip: customers.filter(c => c.status === 'VIP').length,
        active: customers.filter(c => c.status === 'ACTIVE').length,
      },
      summary: `${customers.length} 个客户（${customers.filter(c => c.status === 'VIP').length} VIP, ${customers.filter(c => c.status === 'ACTIVE').length} 活跃）`,
      data: customers.map(c => ({
        id: c.id,
        name: c.name,
        company: c.company,
        status: statusLabel[c.status] || c.status,
        industry: c.industry,
        projectCount: c._count.projects,
        lastContact: c.communications[0]?.createdAt.toISOString().split('T')[0] || null,
      })),
    };
  },
};

export const deleteCustomerTool: ToolDefinition = {
  name: 'delete_customer',
  description: '删除客户。有关联项目时不能删除。用户说"删除客户""删掉XX客户"时调用。写操作需确认。',
  category: 'client',
  access: 'write',
  requiresConfirmation: true,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: '客户 ID' },
      customerName: { type: 'string', description: '客户名，模糊匹配' },
    },
  },
  handler: async (args, userId) => {
    let customerId = args.customerId as string | undefined;
    if (!customerId && args.customerName) {
      const customer = await prisma.customer.findFirst({ where: { userId, name: { contains: args.customerName as string } } });
      if (customer) customerId = customer.id;
    }
    if (!customerId) return { error: '请指定客户' };

    const customer = await prisma.customer.findFirst({ where: { id: customerId, userId } });
    if (!customer) return { error: '未找到该客户' };

    const projectCount = await prisma.project.count({ where: { customerId } });
    if (projectCount > 0) return { error: `该客户有 ${projectCount} 个关联项目，请先解除关联再删除` };

    await prisma.customer.delete({ where: { id: customerId } });
    return {
      success: true,
      action: '删除客户',
      summary: `已删除客户「${customer.name}」`,
      details: {},
    };
  },
};
