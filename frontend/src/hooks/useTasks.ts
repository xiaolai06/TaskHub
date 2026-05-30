import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const QUERY_KEY = 'tasks';

export interface TaskChild {
  id: string;
  title: string;
  status: string;
  progress: number;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  estimatedHours: number;
  actualHours: number | null;
  cost: number;
  costNote: string | null;
  blockedReason: string | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  projectId: string;
  assigneeId: string | null;
  parentId: string | null;
  progress: number;
  createdAt: string;
  updatedAt: string;
  assignee?: { id: string; name: string } | null;
  project?: { id: string; name: string; budget?: number | null };
  children?: Task[];
  parent?: { id: string; title: string } | null;
  _count?: { children: number };
  taskCost?: number;
  childrenCost?: number;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  estimatedHours?: number;
  actualHours?: number;
  cost?: number;
  costNote?: string;
  blockedReason?: string;
  startDate?: string;
  dueDate?: string;
  projectId: string;
  assigneeId?: string;
  parentId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  estimatedHours?: number;
  actualHours?: number;
  cost?: number;
  costNote?: string;
  blockedReason?: string;
  startDate?: string;
  dueDate?: string;
  assigneeId?: string;
  parentId?: string | null;
  progress?: number;
}

export interface TaskQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  projectId?: string;
  assigneeId?: string;
  parentId?: string;
  search?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  sortBy?: 'priority' | 'dueDate' | 'createdAt' | 'estimatedHours' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface TaskListResponse {
  data: Task[];
  total: number;
  page: number;
  limit: number;
}

/** 获取项目下的任务（顶层 + 子任务） */
export function useProjectTasks(projectId: string) {
  return useQuery<Task[]>({
    queryKey: [QUERY_KEY, 'project', projectId],
    queryFn: () => api.get(`/tasks/project/${projectId}`),
    enabled: !!projectId,
  });
}

/** 获取任务列表（带筛选 + 排序） */
export function useTaskList(params?: TaskQueryParams) {
  return useQuery<TaskListResponse>({
    queryKey: [QUERY_KEY, 'list', params],
    queryFn: () => {
      const sp = new URLSearchParams();
      if (params?.status) sp.set('status', params.status);
      if (params?.priority) sp.set('priority', params.priority);
      if (params?.projectId) sp.set('projectId', params.projectId);
      if (params?.assigneeId) sp.set('assigneeId', params.assigneeId);
      if (params?.parentId) sp.set('parentId', params.parentId);
      if (params?.search) sp.set('search', params.search);
      if (params?.dueDateFrom) sp.set('dueDateFrom', params.dueDateFrom);
      if (params?.dueDateTo) sp.set('dueDateTo', params.dueDateTo);
      if (params?.sortBy) sp.set('sortBy', params.sortBy);
      if (params?.sortOrder) sp.set('sortOrder', params.sortOrder);
      if (params?.page) sp.set('page', String(params.page));
      if (params?.limit) sp.set('limit', String(params.limit));
      const qs = sp.toString();
      return api.get(`/tasks${qs ? `?${qs}` : ''}`);
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTaskInput) => api.post('/tasks', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaskInput }) =>
      api.put(`/tasks/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, blockedReason }: { id: string; status: string; blockedReason?: string }) =>
      api.patch(`/tasks/${id}/status`, { status, blockedReason }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: [QUERY_KEY] });
      const previous = qc.getQueriesData({ queryKey: [QUERY_KEY] });
      qc.setQueriesData({ queryKey: [QUERY_KEY] }, (old: TaskListResponse | Task[] | undefined) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((t) => (t.id === id ? { ...t, status } : t));
        }
        if ('data' in old && Array.isArray(old.data)) {
          return { ...old, data: old.data.map((t) => (t.id === id ? { ...t, status } : t)) };
        }
        return old;
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          qc.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
