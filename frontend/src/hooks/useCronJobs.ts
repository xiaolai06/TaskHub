'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface CronJob {
  id: string;
  name: string;
  cronExpr: string;
  timezone: string;
  action: 'NOTIFY' | 'AI_ANALYSIS' | 'WEBHOOK';
  config: string;
  enabled: boolean;
  isSystem: boolean;
  aiModel: string | null;
  jobSlug: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastResult: string | null;
  createdAt: string;
  updatedAt: string;
}

const QUERY_KEY = 'cron-jobs';

export function useCronJobs(enabled?: boolean) {
  return useQuery<CronJob[]>({
    queryKey: [QUERY_KEY, 'list', enabled],
    queryFn: () => {
      const qs = enabled !== undefined ? `?enabled=${enabled}` : '';
      return api.get(`/cron-jobs${qs}`);
    },
  });
}

export function useCreateCronJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; cronExpr: string; action: string; config?: string }) =>
      api.post('/cron-jobs', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useUpdateCronJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put(`/cron-jobs/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useDeleteCronJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/cron-jobs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useInitSystemJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/cron-jobs/system/init'),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useRunJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobSlug: string) => api.post<{ result?: string; label?: string }>(`/jobs/${jobSlug}/run`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export interface TestNotifyResult {
  results: Array<{ channel: string; ok: boolean; msg: string }>;
  allOk: boolean;
}

export function useTestNotify() {
  return useMutation({
    mutationFn: (id: string) => api.post<TestNotifyResult>(`/cron-jobs/${id}/test-notify`),
  });
}

// ═══ 自定义任务执行/测试 ═══

export interface CustomJobTestResult {
  preview: string;
  channels: Array<{ name: string; status: string }>;
}

export function useRunCustomJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<{ result: string; durationMs: number }>(`/cron-jobs/${id}/run`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useTestCustomJob() {
  return useMutation({
    mutationFn: (id: string) => api.post<CustomJobTestResult>(`/cron-jobs/${id}/test`),
  });
}

// ═══ 执行历史 ═══

export interface JobExecutionEntry {
  id: string;
  status: string;
  result: string | null;
  error: string | null;
  durationMs: number | null;
  executedAt: string;
}

export function useJobHistory(jobId: string) {
  return useQuery<JobExecutionEntry[]>({
    queryKey: [QUERY_KEY, 'history', jobId],
    queryFn: () => api.get(`/cron-jobs/${jobId}/history?limit=20`),
    enabled: !!jobId,
  });
}

export interface AllJobExecutionEntry extends JobExecutionEntry {
  jobSlug: string;
  jobName: string;
}

export function useAllJobHistory(limit = 50) {
  return useQuery<AllJobExecutionEntry[]>({
    queryKey: [QUERY_KEY, 'history-all', limit],
    queryFn: () => api.get(`/cron-jobs/history?limit=${limit}`),
  });
}
