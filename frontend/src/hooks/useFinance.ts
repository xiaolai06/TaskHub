'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

const QUERY_KEY = 'finance';

export interface FinancialSummary {
  income: number;
  expense: number;
  profit: number;
  margin: number;
  receivables: number;
  incomeBreakdown: { projectPayments: number; otherIncome: number };
  expenseBreakdown: { projectCosts: number; operatingCosts: number; subscriptionCosts: number };
}

export interface FinancialTrend {
  month: string;
  income: number;
  expense: number;
  profit: number;
}

export interface FinancialComparison {
  current: FinancialSummary;
  previous: FinancialSummary;
  changes: { income: number; expense: number; profit: number };
}

export function useFinanceSummary(period?: string, type: string = 'month') {
  const params = new URLSearchParams();
  if (period) params.set('period', period);
  params.set('type', type);
  const qs = params.toString();

  return useQuery<FinancialSummary>({
    queryKey: [QUERY_KEY, 'summary', period, type],
    queryFn: () => api.get(`/finance/summary?${qs}`),
  });
}

export function useFinanceTrends(months = 6) {
  return useQuery<FinancialTrend[]>({
    queryKey: [QUERY_KEY, 'trends', months],
    queryFn: () => api.get(`/finance/trends?months=${months}`),
  });
}

export function useFinanceComparison(period?: string, type: string = 'month') {
  const params = new URLSearchParams();
  if (period) params.set('period', period);
  params.set('type', type);
  const qs = params.toString();

  return useQuery<FinancialComparison>({
    queryKey: [QUERY_KEY, 'comparison', period, type],
    queryFn: () => api.get(`/finance/comparison?${qs}`),
  });
}
