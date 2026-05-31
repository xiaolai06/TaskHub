import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const getClientFollowUpTool: ToolDefinition = {
  name: 'get_client_follow_up', description: '获取需要跟进的客户列表。当用户问"该联系谁"、"客户跟进"时调用。', category: 'client', access: 'read', requiresConfirmation: false, preferredModel: 'fast',
  parameters: { type: 'object', properties: { limit: { type: 'number', description: '默认5' } } },
  handler: async (args, userId) => {
    const customers = await prisma.customer.findMany({ where: { userId, status: { in: ['ACTIVE', 'VIP'] } }, include: { communications: { orderBy: { createdAt: 'desc' }, take: 1 }, projects: { where: { status: 'ACTIVE' }, select: { name: true } } } });
    const today = new Date();
    const results = customers.map(c => { const lc = c.communications[0]; const days = lc ? Math.ceil((today.getTime() - lc.createdAt.getTime()) / 86400000) : 999; return { clientName: c.name, company: c.company, lastContact: lc?.createdAt.toISOString().split('T')[0] || '从未', daysSince: days, activeProjects: c.projects.map(p => p.name), flag: days > 14 ? 'URGENT' : days > 7 ? 'NEEDS_FOLLOW_UP' : null }; });
    return results.sort((a, b) => b.daysSince - a.daysSince).slice(0, (args.limit as number) || 5);
  },
};

export const getClientInsightsTool: ToolDefinition = {
  name: 'get_client_insights', description: '查询客户全景。当用户问"这个客户怎么样"、"客户详情"时调用。', category: 'client', access: 'read', requiresConfirmation: false, preferredModel: 'balanced',
  parameters: { type: 'object', properties: { clientName: { type: 'string' } }, required: ['clientName'] },
  handler: async (args, userId) => {
    const c = await prisma.customer.findFirst({ where: { userId, name: { contains: args.clientName as string } }, include: { projects: { select: { name: true, status: true, budget: true } }, communications: { orderBy: { createdAt: 'desc' }, take: 3 } } });
    if (!c) return { error: `未找到客户「${args.clientName}」` };
    return { client: { name: c.name, company: c.company, status: c.status, industry: c.industry }, projects: c.projects.map(p => ({ name: p.name, status: p.status, budget: (p.budget || 0) / 100 })), totalRevenue: c.projects.reduce((s, p) => s + (p.budget || 0), 0) / 100, recentComms: c.communications.map(co => ({ type: co.type, content: co.content.slice(0, 80), date: co.createdAt.toISOString().split('T')[0] })) };
  },
};

export const logCommunicationTool: ToolDefinition = {
  name: 'log_communication', description: '记录客户沟通。写操作，需确认。', category: 'client', access: 'write', requiresConfirmation: true, preferredModel: 'fast',
  parameters: { type: 'object', properties: { clientName: { type: 'string' }, type: { type: 'string', enum: ['EMAIL','PHONE','MEETING','CHAT','OTHER'] }, content: { type: 'string' }, nextFollowAt: { type: 'string' } }, required: ['clientName', 'content'] },
  handler: async (args, userId) => {
    const c = await prisma.customer.findFirst({ where: { userId, name: { contains: args.clientName as string } } }); if (!c) return { error: `未找到客户「${args.clientName}」` };
    const comm = await prisma.communication.create({ data: { userId, customerId: c.id, type: (args.type as string) || 'OTHER', content: args.content as string, nextFollowAt: args.nextFollowAt ? new Date(args.nextFollowAt as string) : null } });
    return { success: true, action: '记录沟通', summary: `已记录与${c.name}的沟通`, details: { '客户': c.name, '类型': comm.type, '内容': comm.content.slice(0, 50) + (comm.content.length > 50 ? '...' : '') } };
  },
};

export const getClientRankingTool: ToolDefinition = {
  name: 'get_client_ranking', description: '客户价值排名。当用户问"客户价值排名"时调用。', category: 'client', access: 'read', requiresConfirmation: false, preferredModel: 'fast',
  parameters: { type: 'object', properties: {} },
  handler: async (_args, userId) => {
    const customers = await prisma.customer.findMany({ where: { userId }, include: { projects: { select: { budget: true, status: true } } } });
    return customers.map(c => ({ name: c.name, company: c.company, status: c.status, totalRevenue: c.projects.reduce((s, p) => s + (p.budget || 0), 0) / 100, projectCount: c.projects.length, activeProjects: c.projects.filter(p => p.status === 'ACTIVE').length })).sort((a, b) => b.totalRevenue - a.totalRevenue);
  },
};
