import type { ToolDefinition } from './types';
import { prisma } from '../../server';
import { calculateSchedule } from '../../services/scheduler.service';

/**
 * 插单评估工具
 * 评估新项目/任务插入对现有排期的影响
 */
export const insertionEvaluationTool: ToolDefinition = {
  name: 'evaluate_insertion',
  description: '评估插入新任务/项目对现有排期的影响，返回受影响的任务列表和项目延期天数。当用户说"接新项目会怎样"、"插单影响"时调用。',
  category: 'schedule',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: '项目 ID' },
      newTaskTitle: { type: 'string', description: '新任务标题' },
      newTaskHours: { type: 'number', description: '新任务预估工时（小时）' },
      newTaskPriority: { type: 'string', description: '新任务优先级：URGENT/HIGH/MEDIUM/LOW' },
      newTaskDueDate: { type: 'string', description: '新任务截止日期（YYYY-MM-DD）' },
      dailyHourLimit: { type: 'number', description: '每日工时上限（默认8）' },
    },
    required: ['projectId', 'newTaskTitle', 'newTaskHours'],
  },
  handler: async (args: Record<string, unknown>, userId: string) => {
    const {
      projectId,
      newTaskTitle,
      newTaskHours,
      newTaskPriority = 'MEDIUM',
      newTaskDueDate,
      dailyHourLimit = 8,
    } = args as {
      projectId: string;
      newTaskTitle: string;
      newTaskHours: number;
      newTaskPriority?: string;
      newTaskDueDate?: string;
      dailyHourLimit?: number;
    };

    // 1. 计算原始排期
    const originalSchedule = await calculateSchedule(userId, {
      projectId,
      dailyHourLimit,
    });

    // 2. 获取现有任务 + 新任务
    const rawTasks = await prisma.task.findMany({
      where: { projectId, status: { not: 'DONE' }, project: { ownerId: userId } },
      select: {
        id: true, title: true, priority: true,
        estimatedHours: true, startDate: true, dueDate: true, status: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const tasks = rawTasks.map(t => ({
      ...t,
      startDate: t.startDate ? t.startDate.toISOString().split('T')[0] : null,
      dueDate: t.dueDate ? t.dueDate.toISOString().split('T')[0] : null,
    }));

    // 加入新任务
    tasks.push({
      id: '__new_task__',
      title: newTaskTitle,
      priority: newTaskPriority,
      estimatedHours: newTaskHours,
      startDate: null,
      dueDate: newTaskDueDate || null,
      status: 'TODO',
    });

    // 3. 重新排期
    // 复用 buildSchedule 逻辑（简化版）
    const PRIORITY_ORDER: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const FAR_FUTURE = '9999-12-31';
    const sorted = [...tasks].sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 2;
      const pb = PRIORITY_ORDER[b.priority] ?? 2;
      if (pa !== pb) return pa - pb;
      const da = a.dueDate || FAR_FUTURE;
      const db = b.dueDate || FAR_FUTURE;
      if (da !== db) return new Date(da).getTime() - new Date(db).getTime();
      return a.estimatedHours - b.estimatedHours;
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cursorDate = new Date(today);
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 365); // 安全上限 1 年
    const workloadMap = new Map<string, number>();
    const taskEndMap = new Map<string, string>();

    for (const task of sorted) {
      let left = task.estimatedHours;
      let lastDay = '';

      while (left > 0) {
        if (cursorDate > maxDate) { lastDay = cursorDate.toISOString().split('T')[0]; break; }
        const dateStr = cursorDate.toISOString().split('T')[0];
        const currentHours = workloadMap.get(dateStr) || 0;
        const available = dailyHourLimit - currentHours;

        if (available <= 0) {
          cursorDate.setDate(cursorDate.getDate() + 1);
          continue;
        }

        const allocate = Math.min(left, available);
        workloadMap.set(dateStr, currentHours + allocate);
        lastDay = dateStr;
        left -= allocate;

        if (left > 0) cursorDate.setDate(cursorDate.getDate() + 1);
      }

      taskEndMap.set(task.id, lastDay);
    }

    // 4. 计算影响
    const originalEndMap = new Map(originalSchedule.tasks.map(t => [t.id, t.scheduledEnd]));
    const affectedTasks: Array<{
      id: string; title: string;
      originalEnd: string; newEnd: string; delayDays: number;
    }> = [];

    for (const [taskId, newEnd] of taskEndMap) {
      if (taskId === '__new_task__') continue;
      const origEnd = originalEndMap.get(taskId);
      if (origEnd && origEnd !== newEnd) {
        const delay = Math.ceil((new Date(newEnd).getTime() - new Date(origEnd).getTime()) / 86400000);
        if (delay > 0) {
          const task = tasks.find(t => t.id === taskId);
          affectedTasks.push({
            id: taskId,
            title: task?.title || '',
            originalEnd: origEnd,
            newEnd,
            delayDays: delay,
          });
        }
      }
    }

    const newTaskEnd = taskEndMap.get('__new_task__') || '';
    const projectDelay = originalSchedule.summary.projectEnd && newTaskEnd
      ? Math.ceil((new Date(newTaskEnd).getTime() - new Date(originalSchedule.summary.projectEnd).getTime()) / 86400000)
      : 0;

    return {
      newTaskScheduled: {
        title: newTaskTitle,
        hours: newTaskHours,
        priority: newTaskPriority,
        scheduledEnd: newTaskEnd,
      },
      impact: {
        affectedTasks: affectedTasks.sort((a, b) => b.delayDays - a.delayDays),
        affectedCount: affectedTasks.length,
        projectEndDateChange: {
          original: originalSchedule.summary.projectEnd,
          new: newTaskEnd,
          delayDays: Math.max(0, projectDelay),
        },
      },
      recommendation: affectedTasks.length === 0
        ? '可以安全插入，不影响现有排期'
        : affectedTasks.length <= 2
        ? `会影响 ${affectedTasks.length} 个任务，建议与相关方沟通`
        : `会影响 ${affectedTasks.length} 个任务，建议重新评估优先级或调整截止日期`,
    };
  },
};
