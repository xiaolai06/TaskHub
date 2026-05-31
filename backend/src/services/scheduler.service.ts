import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** 获取项目排期视图 */
export async function getSchedule(projectId: string) {
  const tasks = await prisma.task.findMany({
    where: { projectId },
    orderBy: [
      { priority: 'asc' },   // URGENT < HIGH < MEDIUM < LOW
      { dueDate: 'asc' },
    ],
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      estimatedHours: true,
      startDate: true,
      dueDate: true,
      progress: true,
    },
  });

  return {
    projectId,
    tasks,
    summary: {
      total: tasks.length,
      todo: tasks.filter(t => t.status === 'TODO').length,
      inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
      done: tasks.filter(t => t.status === 'DONE').length,
      blocked: tasks.filter(t => t.status === 'BLOCKED').length,
      totalHours: tasks.reduce((sum, t) => sum + t.estimatedHours, 0),
    },
  };
}

/** AI 排期建议（返回任务排序和时间建议） */
export async function suggestSchedule(projectId: string) {
  const tasks = await prisma.task.findMany({
    where: { projectId, status: { not: 'DONE' } },
    orderBy: [
      { priority: 'asc' },
      { dueDate: 'asc' },
    ],
  });

  // 简单排期逻辑：按优先级排序，每天最多排 8 小时
  const DAILY_HOURS = 8;
  let currentDate = new Date();
  const suggestions = tasks.map(task => {
    const daysNeeded = Math.ceil(task.estimatedHours / DAILY_HOURS);
    const startDate = new Date(currentDate);
    currentDate = new Date(currentDate.getTime() + daysNeeded * 24 * 60 * 60 * 1000);

    return {
      taskId: task.id,
      title: task.title,
      priority: task.priority,
      estimatedHours: task.estimatedHours,
      suggestedStart: startDate.toISOString().split('T')[0],
      suggestedEnd: currentDate.toISOString().split('T')[0],
      daysNeeded,
    };
  });

  return {
    projectId,
    suggestions,
    totalDays: Math.ceil(tasks.reduce((sum, t) => sum + t.estimatedHours, 0) / DAILY_HOURS),
  };
}

/** 检测排期冲突 */
export async function detectConflicts(projectId: string) {
  const tasks = await prisma.task.findMany({
    where: {
      projectId,
      status: { not: 'DONE' },
      dueDate: { not: null },
    },
    orderBy: { dueDate: 'asc' },
  });

  const conflicts: Array<{ task1: string; task2: string; reason: string }> = [];
  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const t1 = tasks[i];
      const t2 = tasks[j];
      if (t1.dueDate && t2.dueDate) {
        const diff = Math.abs(t1.dueDate.getTime() - t2.dueDate.getTime());
        const hours = diff / (1000 * 60 * 60);
        if (hours < t1.estimatedHours + t2.estimatedHours) {
          conflicts.push({
            task1: t1.title,
            task2: t2.title,
            reason: `截止时间过近（${Math.round(hours)}h），工时不够`,
          });
        }
      }
    }
  }

  return { projectId, conflicts, hasConflicts: conflicts.length > 0 };
}
