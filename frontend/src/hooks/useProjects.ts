import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const QUERY_KEY = 'projects';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  type: string | null;
  budget: number | null;
  usedBudget: number;
  quote?: number;
  actualCost?: number;
  profit?: number;
  expenseNote: string | null;
  rewardNote: string | null;
  startDate: string | null;
  endDate: string | null;
  ownerId: string;
  customerId: string | null;
  customer?: { id: string; name: string; company: string | null } | null;
  createdAt: string;
  updatedAt: string;
  _count?: { tasks: number; costRecords: number };
}

export interface ProjectListResponse {
  data: Project[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  status?: string;
  type?: string;
  budget?: number;
  startDate?: string;
  endDate?: string;
  customerId?: string;
  expenseNote?: string;
  rewardNote?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: string;
  type?: string;
  budget?: number;
  startDate?: string;
  endDate?: string;
  customerId?: string | null;
  expenseNote?: string;
  rewardNote?: string;
}

export interface ProjectListParams {
  page?: number;
  limit?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export function useProjectList(params?: ProjectListParams) {
  return useQuery<ProjectListResponse>({
    queryKey: [QUERY_KEY, params],
    queryFn: () => {
      const sp = new URLSearchParams();
      if (params?.page) sp.set('page', String(params.page));
      if (params?.limit) sp.set('limit', String(params.limit));
      if (params?.status) sp.set('status', params.status);
      if (params?.startDate) sp.set('startDate', params.startDate);
      if (params?.endDate) sp.set('endDate', params.endDate);
      const qs = sp.toString();
      return api.get(`/projects${qs ? `?${qs}` : ''}`);
    },
  });
}

export function useProject(id: string) {
  return useQuery<Project>({
    queryKey: [QUERY_KEY, id],
    queryFn: () => api.get(`/projects/${id}`),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProjectInput) => api.post('/projects', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProjectInput }) =>
      api.put(`/projects/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useArchiveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/projects/${id}/archive`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
