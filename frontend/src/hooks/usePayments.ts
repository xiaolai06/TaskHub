'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const QUERY_KEY = 'payments';

export interface Payment {
  id: string;
  amount: number;
  type: string;
  method: string;
  receivedAt: string;
  note?: string;
  projectId: string;
  project: { id: string; name: string; budget: number };
  createdAt: string;
}

export interface ReceivablesData {
  totalReceivable: number;
  totalReceived: number;
  monthlyReceived: number;
  overdueAmount: number;
  overdueCount: number;
  overallRate: number;
  projects: Array<{
    id: string;
    name: string;
    budget: number;
    received: number;
    outstanding: number;
    rate: number;
    status: string;
    isOverdue: boolean;
    daysSince: number;
  }>;
}

export interface AgingData {
  totalOutstanding: number;
  buckets: { '0-30': number; '31-60': number; '61-90': number; '90+': number };
}

export interface CreatePaymentInput {
  amount: number;
  type: string;
  method?: string;
  receivedAt: string;
  projectId: string;
  note?: string;
}

export function usePayments(projectId?: string) {
  return useQuery<{ data: Payment[]; total: number }>({
    queryKey: [QUERY_KEY, projectId],
    queryFn: () => api.get(`/payments${projectId ? `?projectId=${projectId}` : ''}`),
  });
}

export function useReceivables() {
  return useQuery<ReceivablesData>({
    queryKey: [QUERY_KEY, 'receivables'],
    queryFn: () => api.get('/payments/receivables'),
  });
}

export function useAgingAnalysis() {
  return useQuery<AgingData>({
    queryKey: [QUERY_KEY, 'aging'],
    queryFn: () => api.get('/payments/aging'),
  });
}

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePaymentInput) => api.post('/payments', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['finance'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
