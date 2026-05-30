'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface SettingItem { category: string; key: string; value: string; encrypted: boolean }

const QUERY_KEY = 'settings';

export function useSettings(category: string) {
  return useQuery<SettingItem[]>({
    queryKey: [QUERY_KEY, category],
    queryFn: () => api.get(`/settings/${category}`),
  });
}

export function useUpdateSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ category, key, value, encrypted }: { category: string; key: string; value: string; encrypted?: boolean }) =>
      api.put(`/settings/${category}/${key}`, { value, encrypted }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useBatchUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: Array<{ category: string; key: string; value: string; encrypted?: boolean }>) =>
      api.post('/settings/batch', { settings }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useAiModels(provider: string) {
  return useQuery<{ models: Array<{ id: string; name: string; tier: string }>; baseUrl: string }>({
    queryKey: [QUERY_KEY, 'ai-models', provider],
    queryFn: () => api.get(`/settings/ai/models?provider=${provider}`),
    enabled: !!provider,
  });
}

/** 从官方 API 动态获取模型列表 */
export function useFetchModels() {
  return useMutation({
    mutationFn: ({ provider, apiKey, baseUrl }: { provider: string; apiKey: string; baseUrl?: string }) =>
      api.post<{ models: Array<{ id: string; name: string; tier: string }>; error?: string }>(
        '/settings/ai/fetch-models',
        { provider, apiKey, baseUrl },
      ),
  });
}

export function useTestAiConnection() {
  return useMutation({
    mutationFn: ({ provider, apiKey, baseUrl }: { provider: string; apiKey: string; baseUrl?: string }) =>
      api.post<{ success: boolean; message: string }>('/settings/test-ai', { provider, apiKey, baseUrl }),
  });
}
