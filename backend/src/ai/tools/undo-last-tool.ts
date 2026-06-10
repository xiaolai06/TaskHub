// 撤销最近一次写操作工具
import { ToolDefinition } from './types';
import { prisma } from '../../server';

export const undoLastToolTool: ToolDefinition = {
  name: 'undo_last_tool',
  description: '撤销最近一次写操作（创建/修改/删除）。只能撤销最近一条。',
  category: 'work',
  parameters: {
    type: 'object',
    properties: {},
  },
  handler: async (_args, userId) => {
    const UNDOABLE_TOOLS = ['create_project', 'create_task', 'create_customer', 'update_task_status'];
    const lastLog = await prisma.toolExecutionLog.findFirst({
      where: { userId, toolName: { in: UNDOABLE_TOOLS } },
      orderBy: { executedAt: 'desc' },
    });
    if (!lastLog) return { error: '没有可撤销的操作记录' };

    const { toolName, args: argsStr, result: resultStr } = lastLog;
    const args = JSON.parse(argsStr);
    const result = JSON.parse(resultStr);

    // 根据工具名执行撤销
    try {
      if (toolName === 'create_project' && result?.id) {
        await prisma.project.delete({ where: { id: result.id } });
        return { success: true, message: `已撤销创建项目「${result.name || args.name}」` };
      }
      if (toolName === 'create_task' && result?.id) {
        await prisma.task.delete({ where: { id: result.id } });
        return { success: true, message: `已撤销创建任务「${result.title || args.title}」` };
      }
      if (toolName === 'create_customer' && result?.id) {
        await prisma.customer.delete({ where: { id: result.id } });
        return { success: true, message: `已撤销创建客户「${result.name || args.name}」` };
      }
      if (toolName === 'update_task_status' && result?.id) {
        // 恢复原状态（从 result 中取旧值，如果没有则无法恢复）
        return { success: false, message: '修改状态操作暂不支持自动撤销，请手动修改' };
      }
      if (toolName === 'delete_task') {
        return { success: false, message: '删除操作无法自动撤销，数据已永久删除' };
      }
      return { success: false, message: `工具「${toolName}」暂不支持撤销` };
    } catch (err) {
      return { error: `撤销失败: ${err instanceof Error ? err.message : '未知错误'}` };
    }
  },
  access: 'write',
  requiresConfirmation: false,
  preferredModel: 'fast',
};
