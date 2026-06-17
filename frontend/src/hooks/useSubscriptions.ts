'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const QUERY_KEY = 'subscriptions';

export interface Subscription {
  id: string;
  name: string;
  category: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  cycle: string;
  startDate: string;
  nextBillingAt: string;
  status: string;
  autoRenew: boolean;
  url?: string;
  note?: string;
  createdAt: string;
}

export interface CostSummaryData {
  monthlyTotal: number;
  yearlyEstimate: number;
  activeCount: number;
  byCategory: Array<{ category: string; amount: number; percent: number }>;
}

export interface CreateSubscriptionInput {
  name: string;
  category: string;
  amount: number;
  currency?: string;
  exchangeRate?: number;
  cycle: string;
  startDate: string;
  nextBillingAt: string;
  autoRenew?: boolean;
  url?: string;
  note?: string;
}

export interface UpdateSubscriptionInput extends Partial<CreateSubscriptionInput> {}

export function useSubscriptions(status?: string) {
  return useQuery<{ data: Subscription[]; total: number }>({
    queryKey: [QUERY_KEY, status],
    queryFn: () => api.get(`/subscriptions${status ? `?status=${status}` : ''}`),
  });
}

export function useSubscriptionCostSummary() {
  return useQuery<CostSummaryData>({
    queryKey: [QUERY_KEY, 'cost-summary'],
    queryFn: () => api.get('/subscriptions/cost-summary'),
  });
}

export function useCreateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSubscriptionInput) => api.post('/subscriptions', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['finance'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useUpdateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSubscriptionInput }) =>
      api.put(`/subscriptions/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['finance'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function usePauseSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.put(`/subscriptions/${id}/pause`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useResumeSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.put(`/subscriptions/${id}/resume`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/subscriptions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['finance'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
