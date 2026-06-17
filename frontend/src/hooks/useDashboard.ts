'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import type { DashboardStats, RecentTask, ProjectSummary, CustomerSummary } from './dashboardTypes';

interface DashboardData {
  stats: DashboardStats;
  recentTasks: RecentTask[];
  projects: ProjectSummary[];
  customers: CustomerSummary[];
}

export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const [statsRes, tasksRes, projectsRes, customersRes] = await Promise.allSettled([
        api.get<{ stats: DashboardStats }>('/dashboard/summary'),
        api.get<{ tasks: RecentTask[] }>('/dashboard/recent-activity'),
        api.get<{ projects: ProjectSummary[] }>('/dashboard/project-stats'),
        api.get<{ customers: CustomerSummary[] }>('/dashboard/customer-stats'),
      ]);
      return {
        stats: statsRes.status === 'fulfilled' ? statsRes.value.stats : { projectCount: 0, totalTasks: 0, doneTasks: 0, completionRate: 0, totalCost: 0, monthlyIncome: 0, estimatedProfit: 0, overdueCount: 0 } as DashboardStats,
        recentTasks: tasksRes.status === 'fulfilled' ? tasksRes.value.tasks : [],
        projects: projectsRes.status === 'fulfilled' ? projectsRes.value.projects : [],
        customers: customersRes.status === 'fulfilled' ? customersRes.value.customers : [],
      };
    },
    staleTime: 10_000,
  });
}

export function useRefreshDashboard() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['dashboard'] });
}
