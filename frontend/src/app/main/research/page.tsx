'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Loader2, Search, Star, Bookmark, ExternalLink, Newspaper, Tag, X,
  TrendingUp, Globe, Code, MessageSquare, Sparkles, RotateCw, ChevronRight,
  Clock, Trash2, ChevronDown,
} from 'lucide-react';
import { MarkdownRenderer } from '@/components/features/ai/MarkdownRenderer';

// ═══ 类型 ═══

interface SearchResultItem {
  title: string;
  snippet: string;
  url: string;
  source: string;
  heat?: number;
  extra?: string;
}

interface SavedItem {
  id: string;
  title: string;
  summary: string;
  content: string;
  tags: string;
  searchResultId: string | null;
  createdAt: string;
}

type TabKey = 'briefing' | 'search' | 'saved';

// ═══ 搜索源配置 ═══

const SOURCE_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  github:    { icon: Code,          label: 'GitHub',    color: 'bg-muted text-foreground/80' },
  hackernews:{ icon: TrendingUp,    label: 'Hacker News', color: 'bg-orange-100 text-orange-700' },
  devto:     { icon: MessageSquare, label: 'Dev.to',    color: 'bg-indigo-100 text-indigo-600' },
};

// ═══ 组件 ═══

export default function ResearchPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('briefing');
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [expandedIdx, setExpandedIdx] = useState<Set<number>>(new Set());
  const qc = useQueryClient();

  // ═══ 搜索 ═══

  const {
    data: searchData,
    isFetching: searching,
    refetch: doSearch,
  } = useQuery({
    queryKey: ['research', 'search', searchQuery],
    queryFn: () => api.post<{ query: string; results: SearchResultItem[]; total: number }>('/research/search', { query: searchQuery }),
    enabled: false, // 手动触发
  });

  const results = (searchData?.results || []).filter((r: SearchResultItem) => {
    // 过滤无效内容：标题为空、乱码内容
    if (!r.title || !r.snippet) return false;
    if (r.title.length > 300) return false;
    return true;
  });

  // ═══ 收藏 ═══

  const { data: savedItems = [], refetch: reloadSaved } = useQuery<SavedItem[]>({
    queryKey: ['research', 'saved', tagFilter],
    queryFn: () => api.get(`/research/saved${tagFilter ? `?tag=${tagFilter}` : ''}`),
    enabled: activeTab === 'saved',
  });

  const allTags = [...new Set(savedItems.flatMap((r) => {
    try { return JSON.parse(r.tags) as string[]; } catch { return []; }
  }))];

  const saveMutation = useMutation({
    mutationFn: (item: SearchResultItem) => api.post('/research/saved', {
      title: item.title,
      summary: item.snippet,
      content: item.snippet,
      tags: JSON.stringify([item.source]),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research', 'saved'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/research/saved/${id}`),
    onSuccess: () => reloadSaved(),
  });

  // ═══ AI 简报 ═══

  const [briefing, setBriefing] = useState<{ content: string; generatedAt: string; topics: string[] } | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);

  async function generateBriefing() {
    setBriefingLoading(true);
    try {
      // 从 AI 对话接口生成简报 — 收集各源数据做综合分析
      const res = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: `请生成一份一人公司行业简报（200字以内，Markdown格式）。
内容包括：
1. 今日科技圈值得关注的趋势
2. 对独立开发者/一人公司有价值的工具或动态
3. 一条可操作的商业建议

风格：简洁、直接、可行动。每段用 ### 标题。`,
          conversationId: 'research_briefing',
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        // 非流式返回 { reply: "..." }，流式返回内容
        const content = typeof data.data === 'string' ? data.data : (data.data.reply || data.data.content || '');
        setBriefing({
          content: String(content),
          generatedAt: new Date().toISOString(),
          topics: ['趋势', '工具', '建议'],
        });
      }
    } catch {} finally { setBriefingLoading(false); }
  }

  // ═══ Tab 配置 ═══

  const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'briefing', label: 'AI 简报', icon: Sparkles },
    { key: 'search', label: '搜索发现', icon: Globe },
    { key: 'saved', label: '收藏', icon: Bookmark },
  ];

  // ═══ 渲染 ═══

  return (
    <div className="mx-auto max-w-4xl space-y-5 page-enter">
      {/* Tab 切换 + 搜索栏一体 */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={cn('flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-all',
                activeTab === tab.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-accent')}>
              <tab.icon className="h-3.5 w-3.5" />{tab.label}
            </button>
          ))}
        </div>
        {/* 搜索栏（搜索tab显示） */}
        {activeTab === 'search' && (
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索 GitHub · Hacker News · Dev.to..."
              onKeyDown={(e) => { if (e.key === 'Enter' && searchQuery.trim()) doSearch(); }}
              className="flex-1 bg-transparent text-sm text-foreground/80 outline-none placeholder:text-muted-foreground/50"
            />
            <button
              onClick={() => { if (searchQuery.trim()) doSearch(); }}
              disabled={searching || !searchQuery.trim()}
              className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
              搜索
            </button>
          </div>
        )}
      </div>

      {/* ═══ AI 简报 ═══ */}
      {activeTab === 'briefing' && (
        <div className="rounded-xl border border-border bg-card p-6">
          {briefing ? (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(briefing.generatedAt).toLocaleString('zh-CN')}
                </span>
                <button onClick={generateBriefing} disabled={briefingLoading}
                  className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50">
                  <RotateCw className={cn('h-3 w-3', briefingLoading && 'animate-spin')} />
                  重新生成
                </button>
              </div>
              <div className="prose prose-sm max-w-none text-sm text-foreground/80 leading-relaxed">
                <MarkdownRenderer content={briefing.content} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-12">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50">
                <Newspaper className="h-7 w-7 text-indigo-400" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground/80">AI 行业简报</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                AI 综合多源信息，为你生成今日值得关注的行业动态
              </p>
              <button onClick={generateBriefing} disabled={briefingLoading}
                className="mt-4 flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                {briefingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                立即生成
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══ 搜索发现 ═══ */}
      {activeTab === 'search' && (
        <div>
          {/* 搜索提示 */}
          {!searchQuery && !searching && results.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card py-10 text-center">
              <Globe className="mx-auto h-8 w-8 text-slate-200" />
              <p className="mt-3 text-sm text-muted-foreground">在上方搜索框输入关键词</p>
              <p className="mt-1 text-xs text-muted-foreground">
                自动搜索 GitHub · Hacker News · Dev.to 三个技术社区
              </p>
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                {['独立开发者', 'SaaS 定价', 'AI Agent', 'React 最佳实践', '一人公司'].map(tag => (
                  <button key={tag} onClick={() => { setSearchQuery(tag); doSearch(); }}
                    className="rounded-full border border-border px-3 py-1 transition-colors hover:border-indigo-300 hover:text-indigo-500">
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading */}
          {searching && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
              <span className="ml-2 text-sm text-muted-foreground">搜索中...</span>
            </div>
          )}

          {/* 结果 */}
          {!searching && results.length > 0 && (
            <>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">找到 {searchData?.total || results.length} 条结果</span>
                <span className="text-2xs text-muted-foreground/50">· 按热度排序</span>
              </div>
              <div className="space-y-2">
                {results.map((item, i) => {
                  const cfg = SOURCE_CONFIG[item.source] || { icon: Globe, label: item.source, color: 'bg-muted text-foreground/70' };
                  const isExpanded = expandedIdx.has(i);
                  const isLong = item.snippet.length > 100;
                  const toggleExpand = () => {
                    setExpandedIdx(prev => {
                      const next = new Set(prev);
                      if (next.has(i)) next.delete(i); else next.add(i);
                      return next;
                    });
                  };
                  return (
                    <div key={i}
                      className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-indigo-200 hover:shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', cfg.color)}>
                          <cfg.icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {item.url ? (
                              <a href={item.url} target="_blank" rel="noreferrer"
                                className="truncate text-sm font-semibold text-foreground transition-colors hover:text-indigo-600 hover:underline">
                                {item.title}
                              </a>
                            ) : (
                              <h3 className="truncate text-sm font-semibold text-foreground">{item.title}</h3>
                            )}
                            <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-2xs', cfg.color)}>
                              {cfg.label}
                            </span>
                            {item.extra && (
                              <span className="text-2xs text-muted-foreground">{item.extra}</span>
                            )}
                          </div>
                          <p className={cn(
                            'mt-1 text-xs leading-relaxed text-muted-foreground',
                            !isExpanded && isLong && 'line-clamp-2',
                          )}>{item.snippet}</p>
                          {isLong && (
                            <button onClick={toggleExpand}
                              className="mt-1 flex items-center gap-0.5 text-2xs-plus text-indigo-500 hover:text-indigo-600">
                              {isExpanded ? '收起' : '展开全部'}
                              <ChevronDown className={cn('h-3 w-3 transition-transform', isExpanded && 'rotate-180')} />
                            </button>
                          )}
                          {item.url && (
                            <a href={item.url} target="_blank" rel="noreferrer"
                              className="mt-1.5 inline-flex items-center gap-1 text-2xs text-muted-foreground transition-colors hover:text-indigo-500">
                              <ExternalLink className="h-3 w-3" />
                              打开链接
                            </a>
                          )}
                        </div>
                        <button
                          onClick={() => saveMutation.mutate(item)}
                          className="shrink-0 rounded-lg p-1.5 text-muted-foreground/50 opacity-0 transition-all hover:bg-amber-50 hover:text-amber-500 group-hover:opacity-100"
                          title="收藏">
                          <Star className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* 无结果 */}
          {!searching && searchQuery && results.length === 0 && (
            <div className="flex flex-col items-center py-12">
              <Search className="h-10 w-10 text-slate-200" />
              <p className="mt-3 text-sm text-muted-foreground">各平台都未找到匹配结果</p>
              <p className="mt-1 text-xs text-muted-foreground">换个关键词试试，或者用 AI 面板里的 search_web 全网搜索</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ 收藏 ═══ */}
      {activeTab === 'saved' && (
        <div>
          {allTags.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              <button onClick={() => setTagFilter('')}
                className={cn('rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  !tagFilter ? 'bg-indigo-100 text-indigo-600' : 'bg-muted text-muted-foreground hover:bg-accent')}>
                全部
              </button>
              {allTags.map((tag) => (
                <button key={tag} onClick={() => setTagFilter(tag === tagFilter ? '' : tag)}
                  className={cn('rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    tagFilter === tag ? 'bg-indigo-100 text-indigo-600' : 'bg-muted text-muted-foreground hover:bg-accent')}>
                  {tag}
                </button>
              ))}
            </div>
          )}

          {savedItems.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-border py-12">
              <Bookmark className="h-10 w-10 text-slate-200" />
              <p className="mt-3 text-sm text-muted-foreground">暂无收藏</p>
              <p className="mt-1 text-xs text-muted-foreground">在"搜索发现"中搜索感兴趣的内容，点击星标收藏</p>
            </div>
          ) : (
            <div className="space-y-2">
              {savedItems.map((item) => {
                let tags: string[] = [];
                try { tags = JSON.parse(item.tags); } catch {}
                return (
                  <div key={item.id}
                    className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-border">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.summary}</p>
                      <div className="mt-2 flex items-center gap-2">
                        {tags.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Tag className="h-3 w-3 text-muted-foreground" />
                            {tags.map(t => (
                              <span key={t} className="rounded-full bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground">{t}</span>
                            ))}
                          </div>
                        )}
                        <span className="text-2xs text-muted-foreground">
                          {new Date(item.createdAt).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => { if (confirm('取消收藏？')) deleteMutation.mutate(item.id); }}
                      className="shrink-0 rounded-lg p-1.5 text-muted-foreground/50 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
