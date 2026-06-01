import { prisma } from '../server';
import { AppError, NotFoundError } from '../utils/errors';
import type {
  CalculateScheduleInput,
  InsertionSimulationInput,
} from '../validators/scheduler.schema';

// ======================== 类型定义 ========================

interface TaskInput {
  id: string;
  title: string;
  priority: string;
  estimatedHours: number;
  startDate: string | null;
  dueDate: string | null;
  status: string;
}

interface ScheduledTask {
  id: string;
  title: string;
  priority: string;
  estimatedHours: number;
  scheduledStart: string;
  scheduledEnd: string;
  originalDueDate: string | null;
  isDelayed: boolean;
  delayDays: number;
  isConflict: boolean;
  status: string;
}

interface DailyWorkload {
  date: string;
  hours: number;
  isOverloaded: boolean;
  tasks: string[];
}

interface ScheduleResult {
  tasks: ScheduledTask[];
  dailyWorkload: DailyWorkload[];
  summary: {
    totalTasks: number;
    totalHours: number;
    delayedTasks: number;
    conflictDays: number;
    projectStart: string | null;
    projectEnd: string | null;
  };
}

interface InsertionResult {
  originalSchedule: ScheduleResult;
  newSchedule: ScheduleResult;
  impact: {
    affectedTasks: Array<{
      id: string;
      title: string;
      originalEnd: string;
      newEnd: string;
      delayDays: number;
    }>;
    projectEndDateChange: {
      original: string | null;
      new: string | null;
      delayDays: number;
    };
    newTaskScheduled: {
      scheduledStart: string;
      scheduledEnd: string;
    };
  };
}

// ======================== 优先级排序 ========================

const PRIORITY_ORDER: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

function sortByPriorityAndDueDate(tasks: TaskInput[]): TaskInput[] {
  return [...tasks].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 2;
    const pb = PRIORITY_ORDER[b.priority] ?? 2;
    if (pa !== pb) return pa - pb;

    // 同优先级按截止日期升序
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;

    // 都没有截止日期按工时升序（小任务先做）
    return a.estimatedHours - b.estimatedHours;
  });
}

// ======================== 日期工具函数 ========================

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function diffDays(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

// ======================== 核心排期算法 ========================

export async function calculateSchedule(
  userId: string,
  input: CalculateScheduleInput,
): Promise<ScheduleResult> {
  const { projectId, dailyHourLimit } = input;

  // 校验项目归属
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId: userId },
  });
  if (!project) throw new NotFoundError('项目');

  // 查询所有未完成任务（排除 DONE）
  const rawTasks = await prisma.task.findMany({
    where: {
      projectId,
      status: { not: 'DONE' },
    },
    select: {
      id: true,
      title: true,
      priority: true,
      estimatedHours: true,
      startDate: true,
      dueDate: true,
      status: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const tasks = rawTasks.map((t) => ({
    ...t,
    startDate: t.startDate ? toDateStr(t.startDate) : null,
    dueDate: t.dueDate ? toDateStr(t.dueDate) : null,
  }));

  // 默认跳过周末
  return buildSchedule(tasks, dailyHourLimit, true);
}

// ======================== 日期工具函数 ========================

/** 检查是否是周末 */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // 周日=0, 周六=6
}

/** 跳到下一个工作日 */
function skipToNextWorkday(date: Date): Date {
  const result = new Date(date);
  while (isWeekend(result)) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

// ======================== 排期引擎（纯算法，可复用） ========================

function buildSchedule(
  tasks: TaskInput[],
  dailyHourLimit: number,
  skipWeekends: boolean = true,
): ScheduleResult {
  const sorted = sortByPriorityAndDueDate(tasks);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const scheduled: ScheduledTask[] = [];
  const workloadMap = new Map<string, { hours: number; tasks: string[] }>();
  let cursorDate = skipWeekends ? skipToNextWorkday(new Date(today)) : new Date(today);

  for (const task of sorted) {
    const remaining = task.estimatedHours;
    let firstDay: Date | null = null;
    let lastDay: Date | null = null;
    let left = remaining;

    // 确定起始日期：如果任务有 startDate 且在 cursor 之后，跳到 startDate
    if (task.startDate) {
      const taskStartHint = new Date(task.startDate);
      if (taskStartHint > cursorDate) {
        cursorDate = skipWeekends ? skipToNextWorkday(taskStartHint) : new Date(taskStartHint);
      }
    }

    // 按天分配工时
    while (left > 0) {
      // 跳过周末
      if (skipWeekends && isWeekend(cursorDate)) {
        cursorDate.setDate(cursorDate.getDate() + 1);
        continue;
      }

      const dateStr = toDateStr(cursorDate);
      const day = workloadMap.get(dateStr) ?? { hours: 0, tasks: [] };
      const available = dailyHourLimit - day.hours;

      if (available <= 0) {
        // 当天已满，移到下一天
        cursorDate.setDate(cursorDate.getDate() + 1);
        continue;
      }

      const allocate = Math.min(left, available);
      day.hours += allocate;
      day.tasks.push(task.title);
      workloadMap.set(dateStr, day);

      if (!firstDay) firstDay = new Date(cursorDate);
      lastDay = new Date(cursorDate);
      left -= allocate;

      if (left > 0) {
        cursorDate.setDate(cursorDate.getDate() + 1);
      }
    }

    const scheduledStart = firstDay ? toDateStr(firstDay) : toDateStr(today);
    const scheduledEnd = lastDay ? toDateStr(lastDay) : scheduledStart;
    const endDate = new Date(scheduledEnd);

    // 延期检测：有截止日期且排期结束超过截止日期
    let isDelayed = false;
    let delayDays = 0;
    if (task.dueDate) {
      const due = new Date(task.dueDate);
      if (endDate > due) {
        isDelayed = true;
        delayDays = diffDays(due, endDate);
      }
    }

    // 冲突检测：排期内有工时超限的天
    let isConflict = false;
    if (firstDay && lastDay) {
      let check = new Date(firstDay);
      while (check <= lastDay) {
        const day = workloadMap.get(toDateStr(check));
        if (day && day.hours > dailyHourLimit) {
          isConflict = true;
          break;
        }
        check.setDate(check.getDate() + 1);
      }
    }

    scheduled.push({
      id: task.id,
      title: task.title,
      priority: task.priority,
      estimatedHours: task.estimatedHours,
      scheduledStart,
      scheduledEnd,
      originalDueDate: task.dueDate,
      isDelayed,
      delayDays,
      isConflict,
      status: task.status,
    });
  }

  // 构建每日工时数组
  const dailyWorkload: DailyWorkload[] = [];
  const sortedDates = [...workloadMap.keys()].sort();
  for (const date of sortedDates) {
    const day = workloadMap.get(date)!;
    dailyWorkload.push({
      date,
      hours: Math.round(day.hours * 100) / 100,
      isOverloaded: day.hours > dailyHourLimit,
      tasks: [...new Set(day.tasks)],
    });
  }

  const totalHours = scheduled.reduce((s, t) => s + t.estimatedHours, 0);
  const delayedTasks = scheduled.filter((t) => t.isDelayed).length;
  const conflictDays = dailyWorkload.filter((d) => d.isOverloaded).length;

  return {
    tasks: scheduled,
    dailyWorkload,
    summary: {
      totalTasks: scheduled.length,
      totalHours: Math.round(totalHours * 100) / 100,
      delayedTasks,
      conflictDays,
      projectStart: scheduled.length > 0 ? scheduled[0].scheduledStart : null,
      projectEnd:
        scheduled.length > 0
          ? scheduled[scheduled.length - 1].scheduledEnd
          : null,
    },
  };
}

// ======================== 延期检测 ========================

export async function detectDelays(
  userId: string,
  projectId: string,
) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId: userId },
  });
  if (!project) throw new NotFoundError('项目');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const delayedTasks = await prisma.task.findMany({
    where: {
      projectId,
      status: { notIn: ['DONE'] },
      dueDate: { lt: today },
    },
    select: {
      id: true,
      title: true,
      priority: true,
      dueDate: true,
      estimatedHours: true,
      status: true,
    },
    orderBy: { dueDate: 'asc' },
  });

  return delayedTasks.map((t) => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    dueDate: t.dueDate ? toDateStr(t.dueDate) : null,
    overdueDays: t.dueDate ? diffDays(t.dueDate, today) : 0,
    estimatedHours: t.estimatedHours,
    status: t.status,
  }));
}

// ======================== 冲突检测 ========================

export async function detectConflicts(
  userId: string,
  input: { projectId: string; dailyHourLimit: number },
) {
  const { projectId, dailyHourLimit } = input;

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId: userId },
  });
  if (!project) throw new NotFoundError('项目');

  // 查询有 startDate 和 dueDate 的任务，检测时间段重叠
  const tasksWithDates = await prisma.task.findMany({
    where: {
      projectId,
      status: { notIn: ['DONE'] },
      startDate: { not: null },
      dueDate: { not: null },
    },
    select: {
      id: true,
      title: true,
      startDate: true,
      dueDate: true,
      estimatedHours: true,
    },
    orderBy: { startDate: 'asc' },
  });

  const conflicts: Array<{
    task1: { id: string; title: string; start: string; end: string };
    task2: { id: string; title: string; start: string; end: string };
    overlapDays: number;
    overlapStart: string;
    overlapEnd: string;
  }> = [];

  // 检测时间段重叠
  for (let i = 0; i < tasksWithDates.length; i++) {
    for (let j = i + 1; j < tasksWithDates.length; j++) {
      const a = tasksWithDates[i];
      const b = tasksWithDates[j];

      if (!a.startDate || !a.dueDate || !b.startDate || !b.dueDate) continue;

      const aStart = a.startDate.getTime();
      const aEnd = a.dueDate.getTime();
      const bStart = b.startDate.getTime();
      const bEnd = b.dueDate.getTime();

      // 重叠判断：a.start <= b.end && b.start <= a.end
      if (aStart <= bEnd && bStart <= aEnd) {
        const overlapStart = new Date(Math.max(aStart, bStart));
        const overlapEnd = new Date(Math.min(aEnd, bEnd));

        conflicts.push({
          task1: {
            id: a.id,
            title: a.title,
            start: toDateStr(a.startDate),
            end: toDateStr(a.dueDate),
          },
          task2: {
            id: b.id,
            title: b.title,
            start: toDateStr(b.startDate),
            end: toDateStr(b.dueDate),
          },
          overlapDays: diffDays(overlapStart, overlapEnd),
          overlapStart: toDateStr(overlapStart),
          overlapEnd: toDateStr(overlapEnd),
        });
      }
    }
  }

  // 检测每日工时超载（用排期算法的结果）
  const schedule = await calculateSchedule(userId, {
    projectId,
    dailyHourLimit,
  });
  const overloadedDays = schedule.dailyWorkload.filter(
    (d) => d.isOverloaded,
  );

  return {
    timeOverlapConflicts: conflicts,
    overloadedDays,
    totalConflicts: conflicts.length + overloadedDays.length,
  };
}

// ======================== 插单模拟 ========================

export async function insertionSimulation(
  userId: string,
  input: InsertionSimulationInput,
): Promise<InsertionResult> {
  const { projectId, newTask, dailyHourLimit } = input;

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId: userId },
  });
  if (!project) throw new NotFoundError('项目');

  // 1. 计算原始排期
  const originalSchedule = await calculateSchedule(userId, {
    projectId,
    dailyHourLimit,
  });

  // 2. 查询所有任务 + 新任务，重新排期
  const rawTasks = await prisma.task.findMany({
    where: {
      projectId,
      status: { not: 'DONE' },
    },
    select: {
      id: true,
      title: true,
      priority: true,
      estimatedHours: true,
      startDate: true,
      dueDate: true,
      status: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const tasks = rawTasks.map((t) => ({
    ...t,
    startDate: t.startDate ? toDateStr(t.startDate) : null,
    dueDate: t.dueDate ? toDateStr(t.dueDate) : null,
  }));

  // 加入新任务（用临时 ID）
  const virtualTask: TaskInput = {
    id: '__new_task__',
    title: newTask.title,
    priority: newTask.priority,
    estimatedHours: newTask.estimatedHours,
    startDate: newTask.startDate ?? null,
    dueDate: newTask.dueDate ?? null,
    status: 'TODO',
  };
  tasks.push(virtualTask);

  const newSchedule = buildSchedule(tasks, dailyHourLimit);

  // 3. 计算影响：对比每个原有任务的排期变化
  const originalMap = new Map(
    originalSchedule.tasks.map((t) => [t.id, t]),
  );

  const affectedTasks: InsertionResult['impact']['affectedTasks'] = [];
  for (const newT of newSchedule.tasks) {
    if (newT.id === '__new_task__') continue;
    const orig = originalMap.get(newT.id);
    if (!orig) continue;

    if (orig.scheduledEnd !== newT.scheduledEnd) {
      const origEnd = new Date(orig.scheduledEnd);
      const newEnd = new Date(newT.scheduledEnd);
      const delay = diffDays(origEnd, newEnd);
      if (delay > 0) {
        affectedTasks.push({
          id: newT.id,
          title: newT.title,
          originalEnd: orig.scheduledEnd,
          newEnd: newT.scheduledEnd,
          delayDays: delay,
        });
      }
    }
  }

  // 新任务的排期位置
  const newTaskScheduled = newSchedule.tasks.find(
    (t) => t.id === '__new_task__',
  );

  // 项目完成日期变化
  const origEnd = originalSchedule.summary.projectEnd;
  const newEnd = newSchedule.summary.projectEnd;
  const projectDelay =
    origEnd && newEnd ? diffDays(new Date(origEnd), new Date(newEnd)) : 0;

  return {
    originalSchedule,
    newSchedule,
    impact: {
      affectedTasks,
      projectEndDateChange: {
        original: origEnd,
        new: newEnd,
        delayDays: Math.max(0, projectDelay),
      },
      newTaskScheduled: newTaskScheduled
        ? {
            scheduledStart: newTaskScheduled.scheduledStart,
            scheduledEnd: newTaskScheduled.scheduledEnd,
          }
        : { scheduledStart: '', scheduledEnd: '' },
    },
  };
}
