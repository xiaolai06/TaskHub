'use client';

import { useState } from 'react';
import { BarChart3, Sparkles, Loader2, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { MarkdownRenderer } from '@/components/features/ai/MarkdownRenderer';
import { useGenerateBriefing } from '@/hooks/useResearch';
import type { SearchResultItem } from '@/hooks/useResearch';

interface AnalysisPanelProps {
  results: SearchResultItem[];
  query: string;
}

export function AnalysisPanel({ results, query }: AnalysisPanelProps) {
  const [content, setContent] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const generateMutation = useGenerateBriefing();

  async function handleAnalyze() {
    if (!results.length) return;
    setContent(null);
    setSaved(false);
    try {
      const data = await generateMutation.mutateAsync({
        mode: 'search',
        query,
        items: results.slice(0, 10).map(r => ({ title: r.title, snippet: r.snippet, source: r.source, url: r.url })),
      });
      setContent(data.content);
      setSaved(true);
      toast.success('分析已保存到历史');
    } catch {
      toast.error('分析失败，请检查 AI 配置');
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/30 p-4">
      {!content && !generateMutation.isPending && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-500" />
            <span className="text-sm text-indigo-700">对这 {results.length} 条结果进行 AI 分析</span>
          </div>
          <button onClick={handleAnalyze}
            className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-indigo-700">
            <Sparkles className="h-3 w-3" />
            生成分析
          </button>
        </div>
      )}

      {generateMutation.isPending && (
        <div className="flex items-center justify-center gap-2 py-6">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
          <span className="text-sm text-indigo-600">正在分析搜索结果...</span>
        </div>
      )}

      {content && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-semibold text-indigo-700">AI 分析</span>
              <span className="text-2xs text-indigo-400/70">基于 "{query}"</span>
            </div>
            <div className="flex items-center gap-2">
              {saved && (
                <span className="text-2xs text-green-600 flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                  已保存到历史
                </span>
              )}
              <button onClick={handleAnalyze} disabled={generateMutation.isPending}
                className="flex items-center gap-1 text-2xs text-indigo-500 hover:text-indigo-600 disabled:opacity-50">
                <RotateCw className="h-3 w-3" />
                重新分析
              </button>
            </div>
          </div>
          <div className="prose prose-sm max-w-none text-sm text-foreground/80 leading-relaxed">
            <MarkdownRenderer content={content} />
          </div>
        </div>
      )}
    </div>
  );
}
