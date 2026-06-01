import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const createProjectTool: ToolDefinition = {
  name: 'create_project',
  description:
    '创建新订单/项目。支持名称、描述、类型、报价（元）、开始日期、截止日期、关联客户、成本备注。'
    + '用户说“新建项目”“开个订单”“加个项目”“创建项目”时调用。没说的字段用默认值（开始日期=今天，状态=进行中，报价=0），不追问。写操作需确认。',
  category: 'work',
  access: 'write',
  requiresConfirmation: true,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '项目/订单名称，必填' },
      description: { type: 'string', description: '项目描述、范围或备注' },
      type: { type: 'string', description: '类型标签：开发/设计/运营/咨询/营销/其他' },
      budget: { type: 'number', description: '报价（元），如 5000 表示 ¥5,000' },
      startDate: { type: 'string', description: '开始日期 YYYY-MM-DD，默认今天' },
      endDate: { type: 'string', description: '截止日期/预计完成日期 YYYY-MM-DD' },
      customerName: { type: 'string', description: '关联客户名，模糊匹配' },
      expenseNote: { type: 'string', description: '成本备注' },
    },
    required: ['name'],
  },
  handler: async (args, userId) => {
    let customerId: string | undefined;
    if (args.customerName) {
      const customer = await prisma.customer.findFirst({ where: { userId, name: { contains: args.customerName as string } } });
      if (customer) customerId = customer.id;
    }

    const project = await prisma.project.create({
      data: {
        name: args.name as string,
        description: (args.description as string) || null,
        type: (args.type as string) || null,
        budget: args.budget != null ? Math.round((args.budget as number) * 100) : 0,
        startDate: args.startDate ? new Date(args.startDate as string) : new Date(),
        endDate: args.endDate ? new Date(args.endDate as string) : null,
        ownerId: userId,
        customerId,
        expenseNote: (args.expenseNote as string) || null,
        rewardNote: null,
        status: 'ACTIVE',
      },
    });

    const details: Record<string, string> = { 名称: project.name, 状态: '进行中' };
    if (args.type) details['类型'] = args.type as string;
    if (args.budget != null) details['报价'] = `¥${args.budget}`;
    if (args.description) details['描述'] = (args.description as string).slice(0, 30);
    if (args.endDate) details['截止'] = args.endDate as string;
    if (args.customerName) details['客户'] = args.customerName as string;
    return { success: true, action: '创建项目', summary: `已创建项目「${project.name}」`, details };
  },
};

export const updateProjectTool: ToolDefinition = {
  name: 'update_project',
  description:
    '更新项目/订单信息。支持修改名称、状态（ACTIVE进行中/COMPLETED已完成/ARCHIVED已归档）、报价、类型、描述、截止日期。'
    + '用户说“改项目”“更新项目”“把XX改为已完成”“XX项目加个截止日期”时调用。写操作需确认。',
  category: 'work',
  access: 'write',
  requiresConfirmation: true,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: '项目 ID' },
      projectName: { type: 'string', description: '项目名，模糊匹配' },
      name: { type: 'string', description: '新名称' },
      status: { type: 'string', enum: ['ACTIVE', 'COMPLETED', 'ARCHIVED'], description: 'ACTIVE=进行中，COMPLETED=已完成，ARCHIVED=已归档' },
      budget: { type: 'number', description: '新报价（元）' },
      type: { type: 'string', description: '新类型标签' },
      description: { type: 'string', description: '新描述' },
      endDate: { type: 'string', description: '新截止日期 YYYY-MM-DD' },
    },
    required: [],
  },
  handler: async (args, userId) => {
    let projectId = args.projectId as string | undefined;
    if (!projectId && args.projectName) {
      const project = await prisma.project.findFirst({ where: { ownerId: userId, name: { contains: args.projectName as string } } });
      if (!project) return { error: `未找到项目「${args.projectName}」` };
      projectId = project.id;
    }
    if (!projectId) return { error: '请提供项目 ID 或名称' };

    const data: Record<string, unknown> = {};
    if (args.name) data.name = args.name;
    if (args.status) data.status = args.status;
    if (args.budget != null) data.budget = Math.round((args.budget as number) * 100);
    if (args.type) data.type = args.type;
    if (args.description !== undefined) data.description = args.description;
    if (args.endDate) data.endDate = new Date(args.endDate as string);

    await prisma.project.updateMany({ where: { id: projectId, ownerId: userId }, data });
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    return { success: true, action: '更新项目', summary: `已更新项目「${project?.name}」`, details: { 名称: project?.name || '', 状态: project?.status || '' } };
  },
};