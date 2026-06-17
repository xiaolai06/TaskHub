import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const deleteProjectTool: ToolDefinition = {
  name: 'delete_project',
  description: `永久删除项目及其所有关联数据（任务、成本记录、回款记录）。不可恢复，需用户确认。

使用时机:
- "删除项目XXX"、"把这个项目删掉"
- "清理已废弃的项目"

不使用时机:
- 项目还在进行中 → 用 archive_project 归档
- 只想更新状态 → 用 update_project`,
  category: 'work',
  access: 'write',
  requiresConfirmation: true,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: '项目 ID' },
      projectName: { type: 'string', description: '项目名，模糊匹配' },
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

    const project = await prisma.project.findFirst({ where: { id: projectId, ownerId: userId } });
    if (!project) return { error: '项目不存在或无权访问' };

    await prisma.$transaction([
      prisma.costRecord.deleteMany({ where: { projectId } }),
      prisma.task.deleteMany({ where: { projectId } }),
      prisma.payment.deleteMany({ where: { projectId } }),
      prisma.project.deleteMany({ where: { id: projectId, ownerId: userId } }),
    ]);

    return {
      success: true,
      action: '删除项目',
      summary: `已永久删除项目「${project.name}」及其所有关联数据`,
      details: { 名称: project.name, 状态: project.status },
    };
  },
};
