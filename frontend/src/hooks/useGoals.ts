import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const QUERY_KEY = 'goals';

// ======================== 类型定义 ========================

export type MetricType = 'REVENUE' | 'PROFIT' | 'NEW_ORDERS' | 'PROJECT_COUNT' | 'DELIVERY_RATE' | 'MILESTONE';

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description?: string;
  type: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  metricType: MetricType;
  targetValue?: number | null;
  currentValue: number;
  unit?: string | null;
  progressMode: 'AUTO' | 'MANUAL' | 'MILESTONE';
  status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED' | 'AT_RISK';
  startDate: string;
  endDate: string;
  projectId?: string | null;
  customerId?: string | null;
  reviewNote?: string;
  nextAction?: string;
  createdAt: string;
  updatedAt: string;
  milestones: GoalMilestone[];
  project?: { id: string; name: string; status: string } | null;
  customer?: { id: string; name: string; company?: string } | null;
}

export interface GoalMilestone {
  id: string;
  goalId: string;
  title: string;
  targetValue: number;
  completed: boolean;
  completedAt?: string;
  sortOrder: number;
}

export interface GoalProgressLog {
  id: string;
  goalId: string;
  userId: string;
  value: number;
  note?: string;
  date: string;
  createdAt: string;
}

export interface GoalOverviewItem extends Goal {
  expectedProgress: number;
  actualProgress: number;
  daysLeft: number;
  isAtRisk: boolean;
}

export interface GoalOverview {
  goals: GoalOverviewItem[];
  summary: {
    total: number;
    onTrack: number;
    atRisk: number;
  };
}

export interface CalculateResult {
  goal: Goal;
  calculated: number;
  source: string;
  sourceCount: number;
  message: string;
}

export interface ProjectOption {
  id: string;
  name: string;
  status: string;
}

export interface CustomerOption {
  id: string;
  name: string;
  company?: string;
}

interface GoalParams {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
}

// ======================== 目标 Hooks ========================

export function useGoalList(params?: GoalParams) {
  return useQuery<{ data: Goal[]; total: number }>({
    queryKey: [QUERY_KEY, 'list', params],
    queryFn: () => api.get<{ data: Goal[]; total: number }>('/goals' + buildQuery(params)),
  });
}

export function useGoalDetail(id: string) {
  return useQuery<Goal>({
    queryKey: [QUERY_KEY, 'detail', id],
    queryFn: () => api.get<Goal>(`/goals/${id}`),
    enabled: !!id,
  });
}

export function useGoalOverview() {
  return useQuery<GoalOverview>({
    queryKey: [QUERY_KEY, 'overview'],
    queryFn: () => api.get<GoalOverview>('/goals/overview'),
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => api.post<Goal>('/goals', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QUERY_KEY] }); },
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      api.put<Goal>(`/goals/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QUERY_KEY] }); },
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/goals/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QUERY_KEY] }); },
  });
}

export function useUpdateProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, currentValue }: { id: string; currentValue: number }) =>
      api.patch<Goal>(`/goals/${id}/progress`, { currentValue }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QUERY_KEY] }); },
  });
}

export function useCalculateProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<CalculateResult>(`/goals/${id}/calculate`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QUERY_KEY] }); },
  });
}

export function useProjectList() {
  return useQuery<ProjectOption[]>({
    queryKey: [QUERY_KEY, 'projects'],
    queryFn: () => api.get<ProjectOption[]>('/goals/projects'),
  });
}

export function useCustomerList() {
  return useQuery<CustomerOption[]>({
    queryKey: [QUERY_KEY, 'customers'],
    queryFn: () => api.get<CustomerOption[]>('/goals/customers'),
  });
}

// ======================== 进度日记 Hooks ========================

export function useProgressLogs(goalId: string, enabled = true) {
  return useQuery<GoalProgressLog[]>({
    queryKey: [QUERY_KEY, 'logs', goalId],
    queryFn: () => api.get<GoalProgressLog[]>(`/goals/${goalId}/logs`),
    enabled: !!goalId && enabled,
  });
}

export function useAddProgressLog(goalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => api.post(`/goals/${goalId}/logs`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QUERY_KEY] }); },
  });
}

export function useDeleteProgressLog(goalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (logId: string) => api.delete(`/goals/${goalId}/logs/${logId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QUERY_KEY] }); },
  });
}

// ======================== 里程碑 Hooks ========================

export function useCreateMilestone(goalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => api.post<GoalMilestone>(`/goals/${goalId}/milestones`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QUERY_KEY] }); },
  });
}

export function useUpdateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ goalId, milestoneId, data }: { goalId: string; milestoneId: string; data: unknown }) =>
      api.patch<GoalMilestone>(`/goals/${goalId}/milestones/${milestoneId}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QUERY_KEY] }); },
  });
}

export function useDeleteMilestone(goalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (milestoneId: string) => api.delete(`/goals/${goalId}/milestones/${milestoneId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QUERY_KEY] }); },
  });
}

// ======================== 工具函数 ========================

function buildQuery(params?: GoalParams): string {
  if (!params) return '';
  const entries = Object.entries(params as Record<string, unknown>).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
}
