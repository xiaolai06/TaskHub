'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const QUERY_KEY = 'costs';

export interface CostRecord {
  id: string;
  amount: number;
  category: 'LABOR' | 'MATERIAL' | 'OVERHEAD' | 'OTHER' | string;
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
  category: string;
  description: string;
  date: string;
  taskId?: string;
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
    },
  });
}
