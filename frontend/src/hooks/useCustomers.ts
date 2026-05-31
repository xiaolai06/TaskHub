import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const QUERY_KEY = 'customers';

export interface CustomerProject {
  id: string;
  name: string;
  status: string;
  type: string | null;
  budget: number | null;
  rewardNote: string | null;
  expenseNote: string | null;
  usedBudget: number;
  taskCount: number;
  completedTaskCount: number;
}

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  industry: string | null;
  status: string;
  notes: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  // 关联数据
  projects?: CustomerProject[];
  projectCount?: number;
  totalBudget?: number;
  totalSpent?: number;
  lastContactAt?: string | null;
  lastContactType?: string | null;
  nextFollowAt?: string | null;
  _count?: { communications: number };
  communications?: Communication[];
}

export interface Communication {
  id: string;
  userId: string;
  customerId: string | null;
  projectId: string | null;
  type: string;
  content: string;
  summary: string | null;
  nextFollowAt: string | null;
  createdAt: string;
  project?: { id: string; name: string } | null;
}

export interface CustomerListResponse {
  data: Customer[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateCustomerInput {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  address?: string;
  industry?: string;
  status?: string;
  notes?: string;
}

export interface UpdateCustomerInput {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  address?: string;
  industry?: string;
  status?: string;
  notes?: string;
}

export interface CustomerListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export function useCustomerList(params?: CustomerListParams) {
  return useQuery<CustomerListResponse>({
    queryKey: [QUERY_KEY, params],
    queryFn: () => {
      const sp = new URLSearchParams();
      if (params?.page) sp.set('page', String(params.page));
      if (params?.limit) sp.set('limit', String(params.limit));
      if (params?.search) sp.set('search', params.search);
      if (params?.status) sp.set('status', params.status);
      if (params?.startDate) sp.set('startDate', params.startDate);
      if (params?.endDate) sp.set('endDate', params.endDate);
      const qs = sp.toString();
      return api.get(`/customers${qs ? `?${qs}` : ''}`);
    },
  });
}

export function useCustomer(id: string) {
  return useQuery<Customer>({
    queryKey: [QUERY_KEY, id],
    queryFn: () => api.get(`/customers/${id}`),
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCustomerInput) => api.post('/customers', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCustomerInput }) =>
      api.put(`/customers/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/customers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}
