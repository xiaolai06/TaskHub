import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const QUERY_KEY = 'schedule';

// ======================== 类型定义 ========================

export interface ScheduledTask {
  id: string;
  title: string;
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
  status: string;
  projectId: string;
  projectName: string;
}

export interface DailyWorkload {
  date: string;
  hours: number;
  isOverloaded: boolean;
  tasks: string[];
}

export interface ScheduleData {
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

export interface DelayedTask {
  id: string;
  title: string;
  priority: string;
  dueDate: string | null;
  overdueDays: number;
  estimatedHours: number;
  status: string;
}

export interface ConflictData {
  timeOverlapConflicts: Array<{
    task1: { id: string; title: string; start: string; end: string };
    task2: { id: string; title: string; start: string; end: string };
    overlapDays: number;
    overlapStart: string;
    overlapEnd: string;
  }>;
  overloadedDays: DailyWorkload[];
  totalConflicts: number;
}

export interface InsertionResult {
  originalSchedule: ScheduleData;
  newSchedule: ScheduleData;
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

export interface InsertionInput {
  projectId: string;
  newTask: {
    title: string;
    priority: string;
    estimatedHours: number;
    dueDate?: string;
    startDate?: string;
  };
  dailyHourLimit?: number;
}

// ======================== Hooks ========================

/** 计算项目排期（projectId 为空时计算全部活跃项目） */
export function useSchedule(projectId: string, dailyHourLimit = 8) {
  return useQuery<ScheduleData>({
    queryKey: [QUERY_KEY, 'calculate', projectId, dailyHourLimit],
    queryFn: () =>
      api.post<ScheduleData>('/scheduler/calculate', {
        ...(projectId ? { projectId } : {}),
        dailyHourLimit,
      }),
    enabled: true,
  });
}

/** 查询延期任务（projectId 为空时查全部） */
export function useDelays(projectId: string) {
  return useQuery<DelayedTask[]>({
    queryKey: [QUERY_KEY, 'delays', projectId],
    queryFn: () => api.get<DelayedTask[]>(`/scheduler/delays/${projectId}`),
    enabled: true,
  });
}

/** 查询冲突（projectId 为空时查全部） */
export function useConflicts(projectId: string, dailyHourLimit = 8) {
  return useQuery<ConflictData>({
    queryKey: [QUERY_KEY, 'conflicts', projectId, dailyHourLimit],
    queryFn: () =>
      api.get<ConflictData>(
        `/scheduler/conflicts/${projectId}?dailyHourLimit=${dailyHourLimit}`,
      ),
    enabled: true,
  });
}

/** 插单模拟 */
export function useInsertionSimulation() {
  return useMutation<InsertionResult, Error, InsertionInput>({
    mutationFn: (data) => api.post<InsertionResult>('/scheduler/insertion', data),
  });
}

/** 刷新排期（手动触发重新计算） */
export function useRefreshSchedule(projectId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [QUERY_KEY, 'calculate', projectId] });
    qc.invalidateQueries({ queryKey: [QUERY_KEY, 'delays', projectId] });
    qc.invalidateQueries({ queryKey: [QUERY_KEY, 'conflicts', projectId] });
  };
}
