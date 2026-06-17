'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const QUERY_KEY = 'transactions';

export interface Transaction {
  id: string;
  amount: number;
  direction: 'INCOME' | 'EXPENSE';
  category: string;
  description: string;
  date: string;
  source: 'MANUAL' | 'PAYMENT' | 'SUBSCRIPTION';
  paymentId?: string;
  subscriptionId?: string;
  projectId?: string;
  taskId?: string;
  note?: string;
  payment?: { id: string; type: string; project: { name: string } };
  subscription?: { id: string; name: string };
  project?: { id: string; name: string };
  task?: { id: string; title: string };
  createdAt: string;
}

export interface TransactionListResponse {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateTransactionInput {
  amount: number;
  direction: 'INCOME' | 'EXPENSE';
  category: string;
  description: string;
  date: string;
  projectId?: string;
  taskId?: string;
  note?: string;
}

export interface UpdateTransactionInput {
  amount?: number;
  category?: string;
  description?: string;
  date?: string;
  projectId?: string;
  taskId?: string;
  note?: string;
}

export function useTransactions(params?: Record<string, string | number>) {
  const searchParams = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') searchParams.set(key, String(value));
    }
  }
  const qs = searchParams.toString();

  return useQuery<TransactionListResponse>({
    queryKey: [QUERY_KEY, params],
    queryFn: () => api.get(`/transactions${qs ? `?${qs}` : ''}`),
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTransactionInput) => api.post('/transactions', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: ['finance'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTransactionInput }) =>
      api.put(`/transactions/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: ['finance'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/transactions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: ['finance'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
