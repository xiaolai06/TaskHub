// 撤销最近一次写操作工具
import { ToolDefinition } from './types';
import { prisma } from '../../server';

export const undoLastToolTool: ToolDefinition = {
  name: 'undo_last_tool',
  description: `撤销最近一次写操作。仅支持撤销"创建"类操作（create_project/create_task/create_customer），撤销时会永久删除刚创建的记录。不支持撤销删除、修改、暂停等操作。

使用时机:
- "撤回刚才的操作"、"刚创建的删掉"
- "取消刚才新建的项目/任务/客户"

不使用时机:
- 撤销删除操作 → 删除不可撤销，数据已永久删除
- 撤销修改/更新操作 → 请手动修改回去
- 撤销创建成本/流水/订阅/目标 → 暂不支持，请手动删除`,
  category: 'work',
  parameters: {
    type: 'object',
    properties: {},
  },
  handler: async (_args, userId) => {
    const UNDOABLE_TOOLS = ['create_project', 'create_task', 'create_customer'];
    const lastLog = await prisma.toolExecutionLog.findFirst({
      where: { userId, toolName: { in: UNDOABLE_TOOLS } },
      orderBy: { executedAt: 'desc' },
    });
    if (!lastLog) return { error: '没有可撤销的创建操作记录（仅支持撤销 create_project/create_task/create_customer）' };

    const { toolName, args: argsStr, result: resultStr } = lastLog;
    const args = JSON.parse(argsStr);
    const result = JSON.parse(resultStr);

    try {
      if (toolName === 'create_project' && result?.id) {
        const project = await prisma.project.findFirst({ where: { id: result.id, ownerId: userId } });
        if (!project) return { error: '该项目不存在或无权操作' };
        await prisma.project.delete({ where: { id: result.id } });
        return { success: true, message: `已撤销创建项目「${result.name || args.name}」，数据已永久删除` };
      }
      if (toolName === 'create_task' && result?.id) {
        const task = await prisma.task.findFirst({ where: { id: result.id, project: { ownerId: userId } } });
        if (!task) return { error: '该任务不存在或无权操作' };
        await prisma.task.delete({ where: { id: result.id } });
        return { success: true, message: `已撤销创建任务「${result.title || args.title}」，数据已永久删除` };
      }
      if (toolName === 'create_customer' && result?.id) {
        const customer = await prisma.customer.findFirst({ where: { id: result.id, userId } });
        if (!customer) return { error: '该客户不存在或无权操作' };
        await prisma.customer.delete({ where: { id: result.id } });
        return { success: true, message: `已撤销创建客户「${result.name || args.name}」，数据已永久删除` };
      }
      return { success: false, message: `工具「${toolName}」暂不支持撤销，仅支持撤销 create_project/create_task/create_customer` };
    } catch (err) {
      return { error: `撤销失败: ${err instanceof Error ? err.message : '未知错误'}` };
    }
  },
  access: 'write',
  requiresConfirmation: true,
  preferredModel: 'fast',
};
