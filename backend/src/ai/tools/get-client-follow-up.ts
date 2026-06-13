// 客户工具：创建 + 查询 + 跟进 + 排名
import { prisma } from '../../server';
import { ToolDefinition } from './types';

// ═══ 创建客户 ═══
export const createCustomerTool: ToolDefinition = {
  name: 'create_customer',
  description:
    '创建新客户。支持设置名称、邮箱、电话、公司名、地址、行业、状态（ACTIVE活跃/VIP重要/INACTIVE不活跃/LEAD潜在）、备注。'
    + '用户说"添加客户"、"新建客户"、"加个客户"、"录个客户"时调用。没说的字段不填。写操作，需确认。',
  category: 'client', access: 'write', requiresConfirmation: true, preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      name:     { type: 'string', description: '客户姓名/名称，必填' },
      email:    { type: 'string', description: '邮箱' },
      phone:    { type: 'string', description: '电话' },
      company:  { type: 'string', description: '公司名称' },
      address:  { type: 'string', description: '地址' },
      industry: { type: 'string', description: '行业' },
      status:   { type: 'string', enum: ['ACTIVE', 'VIP', 'INACTIVE', 'LEAD'], default: 'ACTIVE', description: 'ACTIVE=活跃/VIP=重要/INACTIVE=不活跃/LEAD=潜在' },
      notes:    { type: 'string', description: '备注' },
    },
    required: ['name'],
  },
  handler: async (args, userId) => {
    const customer = await prisma.customer.create({
      data: {
        name: args.name as string,
        email: (args.email as string) || null,
        phone: (args.phone as string) || null,
        company: (args.company as string) || null,
        address: (args.address as string) || null,
        industry: (args.industry as string) || null,
        status: (args.status as string) || 'ACTIVE',
        notes: (args.notes as string) || null,
        userId,
      },
    });
    const details: Record<string, string> = { '名称': customer.name, '状态': customer.status };
    if (customer.company) details['公司'] = customer.company;
    if (customer.email) details['邮箱'] = customer.email;
    if (customer.phone) details['电话'] = customer.phone;
    return { success: true, action: '创建客户', summary: `已创建客户「${customer.name}」`, details };
  },
};

// ═══ 更新客户 ═══
export const updateCustomerTool: ToolDefinition = {
  name: 'update_customer',
  description:
    '更新客户信息。支持修改名称、邮箱、电话、公司、地址、行业、状态、备注。用户说"改客户"、"更新客户"、"XX客户改为VIP"时调用。写操作，需确认。',
  category: 'client', access: 'write', requiresConfirmation: true, preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      customerName: { type: 'string', description: '客户名，模糊匹配' },
      name:         { type: 'string', description: '新名称' },
      email:        { type: 'string' },
      phone:        { type: 'string' },
      company:      { type: 'string' },
      address:      { type: 'string' },
      industry:     { type: 'string' },
      status:       { type: 'string', enum: ['ACTIVE', 'VIP', 'INACTIVE', 'LEAD'] },
      notes:        { type: 'string' },
    },
    required: [],
  },
  handler: async (args, userId) => {
    if (!args.customerName) return { error: '请提供客户名称' };
    const c = await prisma.customer.findFirst({ where: { userId, name: { contains: args.customerName as string } } });
    if (!c) return { error: `未找到客户「${args.customerName}」` };
    const data: Record<string, unknown> = {};
    const fields = ['name', 'email', 'phone', 'company', 'address', 'industry', 'status', 'notes'];
    for (const f of fields) if (args[f] !== undefined) data[f] = args[f];
    const updated = await prisma.customer.update({ where: { id: c.id }, data });
    return { success: true, action: '更新客户', summary: `已更新客户「${updated.name}」`, details: { '名称': updated.name, '状态': updated.status } };
  },
};

// ═══ 待跟进客户 ═══
export const getClientFollowUpTool: ToolDefinition = {
  name: 'get_client_follow_up',
  description: `获取需要跟进的客户列表：按距上次沟通天数排序，标注 URGENT(>14天)/NEEDS_FOLLOW_UP(>7天)。支持按月筛选。

使用时机:
- "该联系谁"、"客户跟进"、"哪些客户好久没联系了"
- "需要跟进的客户"、"客户维护"

不使用时机:
- 查看客户收入排名 → 用 get_revenue_by_client
- 查看单个客户详情 → 用 get_client_insights
- 记录沟通内容 → 用 log_communication
- 创建/更新客户信息 → 用 create_customer / update_customer

返回数据: 客户列表含 lastContact/daysSince/activeProjects/flag，支持 month+limit 参数`, category: 'client', access: 'read', requiresConfirmation: false, preferredModel: 'fast',
  parameters: { type: 'object', properties: { limit: { type: 'number', description: '默认5' }, month: { type: 'string', description: '筛选月份 YYYY-MM，只显示该月有沟通记录的客户' } } },
  handler: async (args, userId) => {
    const commWhere: Record<string, unknown> = {};
    if (args.month) {
      const start = new Date((args.month as string) + '-01');
      const end = new Date(start); end.setMonth(end.getMonth() + 1);
      commWhere.createdAt = { gte: start, lt: end };
    }
    const customers = await prisma.customer.findMany({ where: { userId, status: { in: ['ACTIVE', 'VIP'] } }, include: { communications: { where: commWhere, orderBy: { createdAt: 'desc' }, take: 1 }, projects: { where: { status: 'ACTIVE' }, select: { name: true } } } });
    const filtered = args.month ? customers.filter(c => c.communications.length > 0) : customers;
    const today = new Date();
    const results = filtered.map(c => { const lc = c.communications[0]; const days = lc ? Math.ceil((today.getTime() - lc.createdAt.getTime()) / 86400000) : 999; return { clientName: c.name, company: c.company, lastContact: lc?.createdAt.toISOString().split('T')[0] || '从未', daysSince: days, activeProjects: c.projects.map(p => p.name), flag: days > 14 ? 'URGENT' : days > 7 ? 'NEEDS_FOLLOW_UP' : null }; });
    const data = results.sort((a, b) => b.daysSince - a.daysSince).slice(0, (args.limit as number) || 5);
    const urgentCount = data.filter(r => r.flag === 'URGENT').length;
    return {
      meta: { tool: 'get_client_follow_up', timeRange: args.month || '全量', totalInDB: customers.length, returned: data.length },
      highlights: { urgentCount, needFollowUp: data.filter(r => r.flag === 'NEEDS_FOLLOW_UP').length, totalShown: data.length },
      summary: `${data.length}个活跃客户${urgentCount > 0 ? `，${urgentCount}个急需跟进(>14天未联系)` : ''}`,
      data,
    };
  },
};

// ═══ 客户全景 ═══
export const getClientInsightsTool: ToolDefinition = {
  name: 'get_client_insights',
  description: `查询客户全景：基本信息、关联项目列表、最近沟通记录、总收入。

使用时机:
- "这个客户怎么样"、"XX客户详情"、"XX客户的资料"
- "客户信息"、"和XX的合作历史"

不使用时机:
- 查看需要跟进的客户列表 → 用 get_client_follow_up
- 查看客户收入排名 → 用 get_revenue_by_client
- 记录新沟通 → 用 log_communication

返回数据: 客户基本信息/projects(项目列表)/totalRevenue/recentComms(最近3条沟通)`, category: 'client', access: 'read', requiresConfirmation: false, preferredModel: 'balanced',
  parameters: { type: 'object', properties: { clientName: { type: 'string' } }, required: ['clientName'] },
  handler: async (args, userId) => {
    const c = await prisma.customer.findFirst({ where: { userId, name: { contains: args.clientName as string } }, include: { projects: { select: { name: true, status: true, budget: true } }, communications: { orderBy: { createdAt: 'desc' }, take: 3 } } });
    if (!c) return { error: `未找到客户「${args.clientName}」` };
    return { client: { name: c.name, company: c.company, status: c.status, industry: c.industry, phone: c.phone, email: c.email }, projects: c.projects.map(p => ({ name: p.name, status: p.status, budget: (p.budget || 0) / 100 })), totalRevenue: c.projects.reduce((s, p) => s + (p.budget || 0), 0) / 100, activeProjects: c.projects.filter(p => p.status === 'ACTIVE').length, recentComms: c.communications.map(co => ({ type: co.type, content: co.content.slice(0, 80), date: co.createdAt.toISOString().split('T')[0] })) };
  },
};

// ═══ 记录沟通 ═══
export const logCommunicationTool: ToolDefinition = {
  name: 'log_communication', description: '记录客户沟通。当用户说"记录沟通"、"和XX聊了"、"XX客户说了什么"时调用。写操作，需确认。', category: 'client', access: 'write', requiresConfirmation: true, preferredModel: 'fast',
  parameters: { type: 'object', properties: { clientName: { type: 'string' }, type: { type: 'string', enum: ['EMAIL','PHONE','MEETING','CHAT','OTHER'] }, content: { type: 'string' }, nextFollowAt: { type: 'string', description: '下次跟进日期' } }, required: ['clientName', 'content'] },
  handler: async (args, userId) => {
    const c = await prisma.customer.findFirst({ where: { userId, name: { contains: args.clientName as string } } }); if (!c) return { error: `未找到客户「${args.clientName}」` };
    const comm = await prisma.communication.create({ data: { userId, customerId: c.id, type: (args.type as string) || 'OTHER', content: args.content as string, nextFollowAt: args.nextFollowAt ? new Date(args.nextFollowAt as string) : null } });
    return { success: true, action: '记录沟通', summary: `已记录与${c.name}的沟通`, details: { '客户': c.name, '类型': comm.type, '内容': comm.content.slice(0, 50) + (comm.content.length > 50 ? '...' : '') } };
  },
};

// ═══ 客户价值排名 ═══
export const getClientRankingTool: ToolDefinition = {
  name: 'get_client_ranking',
  description: `客户价值排名：汇总每个客户的项目预算，按总收入降序排列。支持按月筛选。

使用时机:
- "客户价值排名"、"哪个客户最重要"
- "客户贡献排名"、"大客户是谁"

不使用时机:
- 查看需要跟进的客户 → 用 get_client_follow_up
- 查看单个客户详情 → 用 get_client_insights
- 查看项目利润 → 用 get_profit_analysis

返回数据: 客户列表含 totalRevenue/projectCount/activeProjects，支持 month 参数`, category: 'client', access: 'read', requiresConfirmation: false, preferredModel: 'fast',
  parameters: { type: 'object', properties: { month: { type: 'string', description: '筛选月份 YYYY-MM，只统计该月创建的项目' } } },
  handler: async (args, userId) => {
    const projectWhere: Record<string, unknown> = {};
    if (args.month) {
      const start = new Date((args.month as string) + '-01');
      const end = new Date(start); end.setMonth(end.getMonth() + 1);
      projectWhere.createdAt = { gte: start, lt: end };
    }
    const customers = await prisma.customer.findMany({ where: { userId }, include: { projects: { where: projectWhere, select: { budget: true, status: true } } } });
    const data = customers.filter(c => c.projects.length > 0).map(c => ({ name: c.name, company: c.company, status: c.status, totalRevenue: c.projects.reduce((s, p) => s + (p.budget || 0), 0) / 100, projectCount: c.projects.length, activeProjects: c.projects.filter(p => p.status === 'ACTIVE').length })).sort((a, b) => b.totalRevenue - a.totalRevenue);
    const top3 = data.slice(0, 3).map(c => `${c.name} ¥${c.totalRevenue}`);
    const totalRevenue = data.reduce((s, c) => s + c.totalRevenue, 0);
    return {
      meta: { tool: 'get_client_ranking', timeRange: args.month || '全量', totalInDB: customers.length, returned: data.length },
      highlights: { totalRevenue: Math.round(totalRevenue * 100) / 100, top3, clientCount: data.length },
      summary: `${args.month ? args.month + '月' : '全部'}${data.length}个客户，总收入¥${Math.round(totalRevenue)}${top3.length > 0 ? `，最高${top3[0]}` : ''}`,
      data,
    };
  },
};
