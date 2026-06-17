'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ═══ 类型 ═══

export interface SearchResultItem {
  title: string;
  snippet: string;
  url: string;
  source: string;
  heat?: number;
  extra?: string;
}

export interface SavedItem {
  id: string;
  title: string;
  summary: string;
  content: string;
  tags: string;
  searchResultId: string | null;
  createdAt: string;
}

export interface BriefingItem {
  id: string;
  title: string;
  content: string;
  mode: string;
  query: string | null;
  tags: string;
  saved: boolean;
  createdAt: string;
}

export interface GroupedHistory {
  query: string;
  count: number;
  sources: Record<string, number>;
  latestAt: string;
}

// ═══ 搜索历史（分组）═══

export function useHistoryGrouped(enabled: boolean) {
  return useQuery<GroupedHistory[]>({
    queryKey: ['research', 'history', 'grouped'],
    queryFn: () => api.get('/research/history/grouped?limit=10'),
    enabled,
  });
}

export function useClearHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete('/research/history'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research', 'history'] }),
  });
}

// ═══ 搜索 ═══

export function useSearch() {
  return useMutation({
    mutationFn: (query: string) =>
      api.post<{ query: string; results: SearchResultItem[]; total: number }>('/research/search', { query }),
  });
}

// ═══ 收藏 ═══

export function useSavedItems(tagFilter: string, enabled: boolean) {
  return useQuery<SavedItem[]>({
    queryKey: ['research', 'saved', tagFilter],
    queryFn: () => api.get(`/research/saved${tagFilter ? `?tag=${tagFilter}` : ''}`),
    enabled,
  });
}

export function useSavedBriefings(enabled: boolean) {
  return useQuery<{ data: BriefingItem[] }>({
    queryKey: ['research', 'briefings', 'saved'],
    queryFn: () => api.get('/research/briefings?saved=true&limit=50'),
    enabled,
  });
}

export function useSaveItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: SearchResultItem) =>
      api.post('/research/saved', {
        title: item.title,
        summary: item.snippet,
        content: item.snippet,
        tags: JSON.stringify([item.source]),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research', 'saved'] }),
  });
}

export function useDeleteSaved() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/research/saved/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research', 'saved'] }),
  });
}

// ═══ 简报 ═══

export function useHistoryBriefings(enabled: boolean) {
  return useQuery<{ data: BriefingItem[] }>({
    queryKey: ['research', 'briefings', 'history'],
    queryFn: () => api.get('/research/briefings?limit=20'),
    enabled,
  });
}

export function useGenerateBriefing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { mode: 'search'; query: string; items: Pick<SearchResultItem, 'title' | 'snippet' | 'source' | 'url'>[] }) =>
      api.post<BriefingItem>('/research/briefings', params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research', 'briefings'] }),
  });
}

export function useDeleteBriefing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/research/briefings/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research', 'briefings'] }),
  });
}

export function useToggleBriefingSaved() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/research/briefings/${id}/save`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['research', 'briefings'] });
    },
  });
}

// ═══ 历史结果 ═══

export function useHistoryResults(query: string | null, enabled: boolean) {
  return useQuery<SearchResultItem[]>({
    queryKey: ['research', 'history', 'results', query],
    queryFn: () => api.get(`/research/history/results?query=${encodeURIComponent(query!)}`),
    enabled: !!query && enabled,
  });
}
