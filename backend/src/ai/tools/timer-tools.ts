import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const startTimerTool: ToolDefinition = {
  name: 'start_timer',
  description: `开始计时。如果有进行中的计时器会自动停止，然后启动新的计时器。

使用时机:
- "开始计时"、"计时开始"
- "记录我在做XX"
- "帮我开始计XX任务的工时"

不使用时机:
- 查看当前计时状态 → 用 get_active_timer
- 手动记录已完成的工时 → 用 log_time`,
  category: 'work_timer',
  access: 'write',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      description: { type: 'string', description: '正在做的事情描述' },
      taskId: { type: 'string', description: '关联的任务 ID（可选）' },
      projectId: { type: 'string', description: '关联的项目 ID（可选）' },
      taskTitle: { type: 'string', description: '任务标题，模糊匹配（可选）' },
    },
  },
  handler: async (args, userId) => {
    let taskId = args.taskId as string | undefined;
    if (!taskId && args.taskTitle) {
      const task = await prisma.task.findFirst({
        where: { project: { ownerId: userId }, title: { contains: args.taskTitle as string } },
        select: { id: true, projectId: true },
      });
      if (task) {
        taskId = task.id;
        if (!args.projectId) args.projectId = task.projectId;
      }
    }

    const { startTimer } = await import('../../services/work.service');
    const timer = await startTimer(userId, {
      description: args.description as string | undefined,
      taskId,
      projectId: args.projectId as string | undefined,
    });

    return {
      success: true,
      action: '开始计时',
      summary: `计时已开始${timer.description ? `：${timer.description}` : ''}`,
      details: {
        计时器ID: timer.id,
        描述: timer.description || '（无描述）',
        开始时间: timer.startedAt.toISOString(),
      },
    };
  },
};

export const stopTimerTool: ToolDefinition = {
  name: 'stop_timer',
  description: `停止当前进行中的计时器。如果有描述说明，会自动写入工时记录。

使用时机:
- "停止计时"、"计时结束"
- "不做了，暂停一下"
- "记录完工时"

不使用时机:
- 暂时休息一会儿 → 用 pause/resume（当前不支持 AI 操作，直接停止即可）
- 查看计时状态 → 用 get_active_timer`,
  category: 'work_timer',
  access: 'write',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      timerId: { type: 'string', description: '计时器 ID（不传则停止当前活跃的计时器）' },
    },
  },
  handler: async (args, userId) => {
    const { stopTimer, getActiveTimer } = await import('../../services/work.service');

    let timerId = args.timerId as string | undefined;
    if (!timerId) {
      const active = await getActiveTimer(userId);
      if (!active || active.length === 0) return { error: '当前没有进行中的计时器' };
      timerId = active[0].id;
    }

    const timer = await stopTimer(userId, timerId);
    if (!timer) return { error: '计时器不存在或已停止' };

    const hours = Math.round(timer.totalMinutes / 6) / 10;
    return {
      success: true,
      action: '停止计时',
      summary: `计时已停止，共 ${hours} 小时${timer.description ? `（${timer.description}）` : ''}`,
      details: {
        描述: timer.description || '（无描述）',
        总时长: `${hours} 小时`,
        有工时记录: !!timer.description,
      },
    };
  },
};
