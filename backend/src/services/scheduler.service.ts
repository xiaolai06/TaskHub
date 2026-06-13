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
  description: string;
  priority: string;
  estimatedHours: number;
  actualHours: number | null;
  startDate: string | null;
  dueDate: string | null;
  status: string;
  projectId: string;
  projectName: string;
}

interface ScheduledTask {
  id: string;
  title: string;
  description: string;
  priority: string;
  estimatedHours: number;
  actualHours: number | null;
  effectiveHours: number;
  scheduledStart: string;
  scheduledEnd: string;
  originalDueDate: string | null;
  isDelayed: boolean;
  delayDays: number;
  isConflict: boolean;
  isOverdue: boolean;
  status: string;
  projectId: string;
  projectName: string;
  workdayAllocs: Record<string, number>; // date → 分配小时数（来自排期引擎）
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

function sortByPriorityAndDueDate(tasks: TaskInput[], today: Date): TaskInput[] {
  return [...tasks].sort((a, b) => {
    // 逾期任务排最前面（不管优先级）
    const aOverdue = a.dueDate && new Date(a.dueDate) < today && a.status !== 'DONE';
    const bOverdue = b.dueDate && new Date(b.dueDate) < today && b.status !== 'DONE';
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;

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
    const aH = a.actualHours ?? a.estimatedHours;
    const bH = b.actualHours ?? b.estimatedHours;
    return aH - bH;
  });
}

// ======================== 日期工具函数 ========================

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

  // 如果指定了项目，校验归属；否则查所有活跃项目
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
    });
    if (!project) throw new NotFoundError('项目');
  }

  // 查询未完成任务（排除 DONE + 排除归档项目）
  const where: Record<string, unknown> = {
    status: { not: 'DONE' },
    project: { ownerId: userId, status: { not: 'ARCHIVED' } },
  };
  if (projectId) where.projectId = projectId;

  const rawTasks = await prisma.task.findMany({
    where,
    select: {
      id: true,
      title: true,
      description: true,
      priority: true,
      estimatedHours: true,
      actualHours: true,
      startDate: true,
      dueDate: true,
      status: true,
      projectId: true,
      project: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const tasks: TaskInput[] = rawTasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description || '',
    priority: t.priority,
    estimatedHours: t.estimatedHours,
    actualHours: t.actualHours,
    startDate: t.startDate ? toDateStr(t.startDate) : null,
    dueDate: t.dueDate ? toDateStr(t.dueDate) : null,
    status: t.status,
    projectId: t.projectId,
    projectName: t.project.name,
  }));

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
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sorted = sortByPriorityAndDueDate(tasks, today);

  // 预处理：计算每个任务的剩余工时 + 初始化状态
  interface TaskState {
    task: TaskInput;
    remaining: number;
    firstDay: string | null;
    lastDay: string | null;
    dayAllocs: Map<string, number>; // date → 分配小时数
    isOverdue: boolean;
  }

  const taskStates: TaskState[] = [];
  for (const task of sorted) {
    const actual = task.actualHours ?? 0;
    const remaining = Math.max(0, task.estimatedHours - actual);
    const isOverdue = !!(task.dueDate && new Date(task.dueDate) < today && task.status !== 'DONE');
    taskStates.push({
      task,
      remaining,
      firstDay: null,
      lastDay: null,
      dayAllocs: new Map(),
      isOverdue,
    });
  }

  // 每日打包算法：逐天遍历，每天按优先级依次安排多个任务
  // 注意：先处理当天，再推进到下一天（避免跳过今天）
  const workloadMap = new Map<string, { hours: number; tasks: string[] }>();
  const maxDays = 365;
  const cursor = new Date(today);

  for (let dayIdx = 0; dayIdx < maxDays; dayIdx++) {
    // 跳过周末
    if (skipWeekends && isWeekend(cursor)) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }

    // 检查是否所有任务都分配完毕
    const allDone = taskStates.every((ts) => ts.remaining <= 0);
    if (allDone) break;

    const dateStr = toDateStr(cursor);
    const dayInfo = workloadMap.get(dateStr) ?? { hours: 0, tasks: [] as string[] };
    let available = dailyHourLimit - dayInfo.hours;

    // 两阶段分配：逾期任务优先独占整天，排完后再排其他任务
    // Phase 1: 只分配逾期任务；Phase 2: 逾期全部完成后，分配所有任务
    const hasPendingOverdue = taskStates.some((ts) => ts.remaining > 0 && ts.isOverdue);

    for (const ts of taskStates) {
      if (ts.remaining <= 0) continue;
      if (available <= 0) break;

      // 逾期未排完时，只分配逾期任务（非逾期任务等 Phase 2）
      if (hasPendingOverdue && !ts.isOverdue) continue;

      // startDate 约束：当天还没到任务的 startDate，跳过
      if (ts.task.startDate) {
        const hint = new Date(ts.task.startDate);
        hint.setHours(0, 0, 0, 0);
        if (cursor < hint) continue;
      }

      const allocate = Math.min(ts.remaining, available);
      ts.remaining -= allocate;
      ts.dayAllocs.set(dateStr, (ts.dayAllocs.get(dateStr) ?? 0) + allocate);
      if (!ts.firstDay) ts.firstDay = dateStr;
      ts.lastDay = dateStr;

      dayInfo.hours += allocate;
      dayInfo.tasks.push(ts.task.title);
      available -= allocate;
    }

    workloadMap.set(dateStr, dayInfo);
    // 先处理再推进：确保今天（cursor 初始值）被处理
    cursor.setDate(cursor.getDate() + 1);
  }

  // 构建排期结果
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const scheduled: ScheduledTask[] = taskStates.map((ts) => {
    const actual = ts.task.actualHours ?? 0;
    const effectiveHours = Math.max(0, ts.task.estimatedHours - actual);
    const scheduledStart = ts.firstDay ?? toDateStr(today);
    const scheduledEnd = ts.lastDay ?? scheduledStart;
    const endDate = new Date(scheduledEnd);

    let isDelayed = false;
    let delayDays = 0;
    if (ts.task.dueDate) {
      const due = new Date(ts.task.dueDate);
      if (endDate > due) {
        isDelayed = true;
        delayDays = diffDays(due, endDate);
      }
    }

    // 逾期标记：截止日期已过且未完成
    let isOverdue = false;
    if (ts.task.dueDate && ts.task.status !== 'DONE') {
      const due = new Date(ts.task.dueDate);
      due.setHours(0, 0, 0, 0);
      if (due < now) isOverdue = true;
    }

    let isConflict = false;
    if (ts.firstDay && ts.lastDay) {
      let check = new Date(ts.firstDay);
      const end = new Date(ts.lastDay);
      while (check <= end) {
        const day = workloadMap.get(toDateStr(check));
        if (day && day.hours > dailyHourLimit) { isConflict = true; break; }
        check.setDate(check.getDate() + 1);
      }
    }

    // 将 dayAllocs Map 序列化为对象，供前端直接使用
    const workdayAllocs: Record<string, number> = {};
    for (const [date, hours] of ts.dayAllocs) {
      workdayAllocs[date] = Math.round(hours * 100) / 100;
    }

    return {
      id: ts.task.id,
      title: ts.task.title,
      description: ts.task.description,
      priority: ts.task.priority,
      estimatedHours: ts.task.estimatedHours,
      actualHours: ts.task.actualHours,
      effectiveHours,
      scheduledStart,
      scheduledEnd,
      originalDueDate: ts.task.dueDate,
      isDelayed,
      delayDays,
      isConflict,
      isOverdue,
      status: ts.task.status,
      projectId: ts.task.projectId,
      projectName: ts.task.projectName,
      workdayAllocs,
    };
  });

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

  const totalHours = scheduled.reduce((s, t) => s + t.effectiveHours, 0);
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
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
    });
    if (!project) throw new NotFoundError('项目');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const where: Record<string, unknown> = {
    status: { notIn: ['DONE'] },
    actualHours: { not: null },
    dueDate: { lt: today },
    project: { ownerId: userId, status: { not: 'ARCHIVED' } },
  };
  if (projectId) where.projectId = projectId;

  const delayedTasks = await prisma.task.findMany({
    where,
    select: {
      id: true,
      title: true,
      priority: true,
      dueDate: true,
      estimatedHours: true,
      actualHours: true,
      status: true,
      project: { select: { name: true } },
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
    actualHours: t.actualHours,
    status: t.status,
    projectName: t.project.name,
  }));
}

// ======================== 冲突检测 ========================

export async function detectConflicts(
  userId: string,
  input: { projectId: string; dailyHourLimit: number },
) {
  const { projectId, dailyHourLimit } = input;

  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
    });
    if (!project) throw new NotFoundError('项目');
  }

  const taskWhere: Record<string, unknown> = {
    status: { notIn: ['DONE'] },
    actualHours: { not: null },
    startDate: { not: null },
    dueDate: { not: null },
    project: { ownerId: userId, status: { not: 'ARCHIVED' } },
  };
  if (projectId) taskWhere.projectId = projectId;

  const tasksWithDates = await prisma.task.findMany({
    where: taskWhere,
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
      description: true,
      priority: true,
      estimatedHours: true,
      actualHours: true,
      startDate: true,
      dueDate: true,
      status: true,
      projectId: true,
      project: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const tasks: TaskInput[] = rawTasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description || '',
    priority: t.priority,
    estimatedHours: t.estimatedHours,
    actualHours: t.actualHours,
    startDate: t.startDate ? toDateStr(t.startDate) : null,
    dueDate: t.dueDate ? toDateStr(t.dueDate) : null,
    status: t.status,
    projectId: t.projectId,
    projectName: t.project.name,
  }));

  // 加入新任务（用临时 ID）
  const virtualTask: TaskInput = {
    id: '__new_task__',
    title: newTask.title,
    description: '',
    priority: newTask.priority,
    estimatedHours: newTask.estimatedHours,
    actualHours: null,
    startDate: newTask.startDate ?? null,
    dueDate: newTask.dueDate ?? null,
    status: 'TODO',
    projectId,
    projectName: '(新任务)',
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
