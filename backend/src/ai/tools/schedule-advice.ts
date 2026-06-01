import type { ToolDefinition } from './types';
import { prisma } from '../../server';
import { calculateSchedule, detectDelays } from '../../services/scheduler.service';

/**
 * 排期建议工具
 * 回答用户关于排期的问题，如"能完成吗？""先做哪个？""什么时候有空？"
 */
export const scheduleAdviceTool: ToolDefinition = {
  name: 'get_schedule_advice',
  description: '分析当前排期状态，回答排期相关问题，给出优先级建议和时间规划。当用户问"能完成吗"、"先做哪个"、"什么时候有空"时调用。',
  category: 'schedule',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: '项目 ID（可选，不传则分析所有项目）' },
      question: { type: 'string', description: '用户的具体问题' },
      targetDate: { type: 'string', description: '目标日期（YYYY-MM-DD），用于判断能否在某日期前完成' },
      dailyHourLimit: { type: 'number', description: '每日工时上限（默认8）' },
    },
    required: ['question'],
  },
  handler: async (args: Record<string, unknown>, userId: string) => {
    const {
      projectId,
      question,
      targetDate,
      dailyHourLimit = 8,
    } = args as {
      projectId?: string;
      question: string;
      targetDate?: string;
      dailyHourLimit?: number;
    };

    // 获取所有未完成任务
    const where: Record<string, unknown> = {
      project: { ownerId: userId },
      status: { not: 'DONE' },
    };
    if (projectId) where.projectId = projectId;

    const tasks = await prisma.task.findMany({
      where,
      include: { project: { select: { id: true, name: true } } },
      orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
    });

    // 统计数据
    const totalTasks = tasks.length;
    const totalHours = tasks.reduce((sum, t) => sum + t.estimatedHours, 0);
    const overdueTasks = tasks.filter(t => t.dueDate && t.dueDate < new Date());
    const urgentTasks = tasks.filter(t => t.priority === 'URGENT');

    // 如果有项目 ID，计算排期
    let scheduleEnd: string | null = null;
    let canCompleteByTarget = false;

    if (projectId) {
      try {
        const schedule = await calculateSchedule(userId, { projectId, dailyHourLimit });
        scheduleEnd = schedule.summary.projectEnd;

        if (targetDate && scheduleEnd) {
          canCompleteByTarget = new Date(scheduleEnd) <= new Date(targetDate);
        }
      } catch {
        // 忽略错误
      }
    }

    // 优先级建议
    const prioritySuggestion = suggestPriority(tasks);

    // 回答生成
    let answer = '';

    if (question.includes('能完成') || question.includes('来得及') || question.includes('截止')) {
      if (targetDate && scheduleEnd) {
        answer = canCompleteByTarget
          ? `按照当前排期，预计 ${scheduleEnd} 完成，在 ${targetDate} 之前可以完成。`
          : `按照当前排期，预计 ${scheduleEnd} 完成，无法在 ${targetDate} 之前完成。建议调整优先级或增加工时。`;
      } else {
        answer = `当前有 ${totalTasks} 个未完成任务，总计 ${totalHours} 小时工时。`;
      }
    } else if (question.includes('先做') || question.includes('优先') || question.includes('顺序')) {
      answer = `建议优先级排序：\n${prioritySuggestion.map((s, i) => `${i + 1}. ${s.title}（${s.priority}，${s.reason}）`).join('\n')}`;
    } else if (question.includes('延期') || question.includes('逾期') || question.includes('过期')) {
      if (overdueTasks.length === 0) {
        answer = '目前没有延期的任务，排期健康。';
      } else {
        answer = `有 ${overdueTasks.length} 个任务已延期：\n${overdueTasks.map(t => `- ${t.title}（截止 ${t.dueDate?.toLocaleDateString('zh-CN')}）`).join('\n')}`;
      }
    } else if (question.includes('空闲') || question.includes('有空') || question.includes('安排')) {
      answer = `当前排期：${totalTasks} 个任务，${totalHours} 小时工时。\n紧急任务：${urgentTasks.length} 个。\n延期任务：${overdueTasks.length} 个。`;
      if (scheduleEnd) answer += `\n预计完成日期：${scheduleEnd}`;
    } else {
      // 通用回答
      answer = `当前项目状态：\n- 未完成任务：${totalTasks} 个\n- 总工时：${totalHours} 小时\n- 紧急任务：${urgentTasks.length} 个\n- 延期任务：${overdueTasks.length} 个`;
      if (scheduleEnd) answer += `\n- 预计完成：${scheduleEnd}`;
    }

    return {
      question,
      answer,
      data: {
        totalTasks,
        totalHours,
        urgentTasks: urgentTasks.length,
        overdueTasks: overdueTasks.length,
        scheduleEnd,
        canCompleteByTarget,
      },
      prioritySuggestion: prioritySuggestion.slice(0, 5),
    };
  },
};

/** 建议任务优先级排序 */
function suggestPriority(tasks: Array<{
  id: string;
  title: string;
  priority: string;
  dueDate: Date | null;
  estimatedHours: number;
}>) {
  const PRIORITY_WEIGHT: Record<string, number> = {
    URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1,
  };

  return tasks
    .map(t => {
      let urgencyScore = PRIORITY_WEIGHT[t.priority] || 2;

      // 截止日期越近，优先级越高
      if (t.dueDate) {
        const daysUntilDue = Math.ceil((t.dueDate.getTime() - Date.now()) / 86400000);
        if (daysUntilDue < 0) urgencyScore += 5; // 已延期
        else if (daysUntilDue <= 2) urgencyScore += 3;
        else if (daysUntilDue <= 7) urgencyScore += 1;
      }

      // 工时短的优先（快速完成）
      if (t.estimatedHours <= 2) urgencyScore += 0.5;

      return {
        id: t.id,
        title: t.title,
        priority: t.priority,
        urgencyScore,
        reason: getReason(t),
      };
    })
    .sort((a, b) => b.urgencyScore - a.urgencyScore);
}

function getReason(task: { priority: string; dueDate: Date | null; estimatedHours: number }) {
  const reasons: string[] = [];
  if (task.priority === 'URGENT') reasons.push('紧急任务');
  if (task.dueDate) {
    const days = Math.ceil((task.dueDate.getTime() - Date.now()) / 86400000);
    if (days < 0) reasons.push(`已延期${Math.abs(days)}天`);
    else if (days <= 2) reasons.push(`即将到期（${days}天后）`);
  }
  if (task.estimatedHours <= 2) reasons.push('快速可完成');
  return reasons.join('，') || '常规优先级';
}
