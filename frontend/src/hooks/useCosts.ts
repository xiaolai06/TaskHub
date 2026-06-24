'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const QUERY_KEY = 'costs';

export interface CostRecord {
  id: string;
  amount: number;
  direction?: 'INCOME' | 'EXPENSE';
  category: string;
  description: string;
  date: string;
  projectId: string;
  taskId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CostListResponse {
  data: CostRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface CostSummary {
  total: number;
  byCategory: Array<{ category: string; amount: number; count: number; percent: number }>;
}

export interface CreateCostInput {
  amount: number;
  direction?: 'INCOME' | 'EXPENSE';
  category: string;
  description: string;
  date: string;
  taskId?: string;
  note?: string;
}

export function useCosts(projectId: string) {
  return useQuery<CostListResponse>({
    queryKey: [QUERY_KEY, projectId, 'list'],
    queryFn: () => api.get(`/costs/project/${projectId}?limit=100`),
    enabled: !!projectId,
  });
}

export function useCostSummary(projectId: string) {
  return useQuery<CostSummary>({
    queryKey: [QUERY_KEY, projectId, 'summary'],
    queryFn: () => api.get(`/costs/project/${projectId}/summary`),
    enabled: !!projectId,
  });
}

export function useCreateCost(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCostInput) => api.post(`/costs/project/${projectId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, projectId] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      // 同步刷新记账中心数据
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useDeleteCost(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/costs/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, projectId] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

/** 批量同步任务中心已有成本到记账中心 */
export function useSyncTaskCosts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId?: string) => api.post('/costs/sync-task-costs', { projectId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}
