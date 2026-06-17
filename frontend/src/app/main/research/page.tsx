'use client';

import { useState } from 'react';
import { Globe, Bookmark, History as HistoryIcon, Loader2, SearchX } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SearchBox } from '@/components/features/research/SearchBox';
import { ResultCard } from '@/components/features/research/ResultCard';
import { AnalysisPanel } from '@/components/features/research/AnalysisPanel';
import { SavedList } from '@/components/features/research/SavedList';
import { HistoryList } from '@/components/features/research/HistoryList';
import {
  useHistoryGrouped, useClearHistory, useSearch,
  useSavedItems, useSavedBriefings, useSaveItem, useDeleteSaved,
  useHistoryBriefings, useDeleteBriefing, useToggleBriefingSaved,
} from '@/hooks/useResearch';
import type { SearchResultItem } from '@/hooks/useResearch';

type TabKey = 'search' | 'saved' | 'history';

const TABS = [
  { key: 'search' as TabKey, label: '搜索发现', icon: Globe },
  { key: 'saved' as TabKey, label: '收藏', icon: Bookmark },
  { key: 'history' as TabKey, label: '历史', icon: HistoryIcon },
];

export default function ResearchPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'search' | 'analysis'>('all');

  // ── 搜索历史 ──
  const { data: historyGrouped = [] } = useHistoryGrouped(activeTab === 'search');
  const clearHistoryMutation = useClearHistory();

  // ── 搜索 ──
  const searchMutation = useSearch();
  const searchData = searchMutation.data;
  const results: SearchResultItem[] = (searchData?.results ?? []).filter(r => r.title && r.snippet && r.title.length <= 300);

  function triggerSearch(query: string) {
    setSearchQuery(query);
    searchMutation.mutate(query);
  }

  // ── 收藏 ──
  const { data: savedItems = [] } = useSavedItems(tagFilter, activeTab === 'saved');
  const { data: savedBriefingsData } = useSavedBriefings(activeTab === 'saved');
  const savedBriefings = savedBriefingsData?.data ?? [];
  const allTags = [...new Set(savedItems.flatMap(r => { try { return JSON.parse(r.tags) as string[]; } catch { return []; } }))];

  const saveMutation = useSaveItem();
  const deleteSavedMutation = useDeleteSaved();

  // ── 历史 ──
  const { data: historyBriefingsData } = useHistoryBriefings(activeTab === 'history');
  const historyBriefings = historyBriefingsData?.data ?? [];
  const deleteBriefingMutation = useDeleteBriefing();
  const toggleBriefingSaveMutation = useToggleBriefingSaved();

  function handleDeleteSaved(id: string) {
    if (confirm('取消收藏？')) {
      deleteSavedMutation.mutate(id, { onSuccess: () => toast.success('已取消收藏') });
    }
  }

  function handleDeleteBriefing(id: string) {
    if (confirm('删除此分析？')) {
      deleteBriefingMutation.mutate(id, { onSuccess: () => toast.success('简报已删除') });
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 page-enter">
      {/* Tab 栏 */}
      <div className="flex gap-1 rounded-lg border border-border bg-card p-1 w-fit">
        {TABS.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn('flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-all',
              activeTab === tab.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-accent')}>
            <tab.icon className="h-3.5 w-3.5" />{tab.label}
          </button>
        ))}
      </div>

      {/* ═══ 搜索发现 Tab ═══ */}
      {activeTab === 'search' && (
        <div>
          <SearchBox
            value={searchQuery}
            onChange={setSearchQuery}
            onSearch={triggerSearch}
            searching={searchMutation.isPending}
            historyGrouped={historyGrouped}
            onClearHistory={() => clearHistoryMutation.mutate()}
          />

          {/* 初始提示 */}
          {!searchQuery && !searchMutation.isPending && results.length === 0 && (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-card py-10 text-center">
              <Globe className="mx-auto h-8 w-8 text-slate-200" />
              <p className="mt-3 text-sm text-muted-foreground">在上方搜索框输入关键词</p>
              <p className="mt-1 text-xs text-muted-foreground">同时搜索 GitHub · Hacker News · Dev.to · DuckDuckGo · SearXNG</p>
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground flex-wrap">
                {['独立开发者', 'SaaS 定价', 'AI Agent', 'React 最佳实践', '一人公司'].map(tag => (
                  <button key={tag} onClick={() => triggerSearch(tag)}
                    className="rounded-full border border-border px-3 py-1 transition-colors hover:border-indigo-300 hover:text-indigo-500">
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading */}
          {searchMutation.isPending && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
              <span className="ml-2 text-sm text-muted-foreground">搜索中...</span>
            </div>
          )}

          {/* 搜索结果 */}
          {!searchMutation.isPending && results.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  找到 {searchData?.total ?? results.length} 条结果 · 按热度排序
                </span>
                <div className="flex items-center gap-2 text-2xs text-muted-foreground/50">
                  <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-gray-400" />GitHub</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-orange-400" />HN</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-400" />Dev.to</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />DDG</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />SearXNG</span>
                </div>
              </div>

              {results.map((item, i) => (
                <ResultCard key={item.url ?? i} item={item} index={i} onSave={(item) => saveMutation.mutate(item)} />
              ))}

              <AnalysisPanel results={results} query={searchQuery} />
            </div>
          )}

          {/* 无结果 */}
          {!searchMutation.isPending && searchQuery && !searchData && results.length === 0 && (
            <div className="flex flex-col items-center py-12">
              <SearchX className="h-10 w-10 text-slate-200" />
              <p className="mt-3 text-sm text-muted-foreground">各平台都未找到匹配结果</p>
              <p className="mt-1 text-xs text-muted-foreground">换个关键词试试</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ 收藏 Tab ═══ */}
      {activeTab === 'saved' && (
        <SavedList
          savedItems={savedItems}
          savedBriefings={savedBriefings}
          allTags={allTags}
          tagFilter={tagFilter}
          onTagFilterChange={setTagFilter}
          onDelete={handleDeleteSaved}
          onToggleBriefingSave={(id) => toggleBriefingSaveMutation.mutate(id)}
        />
      )}

      {/* ═══ 历史 Tab ═══ */}
      {activeTab === 'history' && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {([
                { key: 'all' as const, label: '全部' },
                { key: 'search' as const, label: '搜索记录' },
                { key: 'analysis' as const, label: 'AI 分析' },
              ]).map(f => (
                <button key={f.key} onClick={() => setHistoryFilter(f.key)}
                  className={cn('rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    historyFilter === f.key ? 'bg-indigo-100 text-indigo-600' : 'bg-muted text-muted-foreground hover:bg-accent')}>
                  {f.label}
                </button>
              ))}
            </div>
            {historyGrouped.length > 0 && (
              <span className="text-2xs text-muted-foreground">共 {historyGrouped.length} 条搜索记录</span>
            )}
          </div>
          <HistoryList
            historyGrouped={historyGrouped}
            historyBriefings={historyBriefings}
            historyFilter={historyFilter}
            onDeleteBriefing={handleDeleteBriefing}
            onToggleBriefingSave={(id) => toggleBriefingSaveMutation.mutate(id)}
            onResearch={(q) => { triggerSearch(q); setActiveTab('search'); }}
          />
        </div>
      )}
    </div>
  );
}
