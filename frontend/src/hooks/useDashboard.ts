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
      const [statsRes, tasksRes, projectsRes, customersRes] = await Promise.all([
        api.get<{ stats: DashboardStats }>('/dashboard/summary'),
        api.get<{ tasks: RecentTask[] }>('/dashboard/recent-activity'),
        api.get<{ projects: ProjectSummary[] }>('/dashboard/project-stats'),
        api.get<{ customers: CustomerSummary[] }>('/dashboard/customer-stats'),
      ]);
      return {
        stats: statsRes.stats,
        recentTasks: tasksRes.tasks,
        projects: projectsRes.projects,
        customers: customersRes.customers,
      };
    },
    staleTime: 10_000,
  });
}

export function useRefreshDashboard() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['dashboard'] });
}
