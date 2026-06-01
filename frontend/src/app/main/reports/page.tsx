'use client';

import { useEffect, useState } from 'react';
import { Calendar, DollarSign, History, Lightbulb, Loader2, PieChart, TrendingDown, TrendingUp, X } from 'lucide-react';
import { MarkdownRenderer } from '@/components/features/ai/MarkdownRenderer';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Overview {
  income: number;
  monthlyIncome?: number;
  expense: number;
  cost?: number;
  quoteTotal?: number;
  profit: number;
  margin: number;
  period: string;
  type: string;
}

interface ProjectRanking {
  id: string;
  name: string;
  quote?: number;
  budget?: number;
  cost: number;
  profit: number;
  margin: number;
  paidInPeriod?: boolean;
}

interface CostStructure { category: string; amount: number; percent: number; }
interface TimeAnalysis { byProject: { project: string; hours: number }[]; totalHours: number; avgPerDay: number; }

type ViewMode = 'day' | 'month' | 'year';

const barColors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-violet-500'];

function fmtYuan(fen: number): string {
  const yuan = fen / 100;
  return yuan >= 10000 ? `¥${(yuan / 10000).toFixed(1)}w` : `¥${yuan.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}

function getDefaultDate(mode: ViewMode): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  if (mode === 'day') return `${y}-${m}-${d}`;
  if (mode === 'year') return `${y}`;
  return `${y}-${m}`;
}

function getPeriod(mode: ViewMode, selectedDate: string) {
  return mode === 'year' ? selectedDate.slice(0, 4) : selectedDate;
}

export default function ReportsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedDate, setSelectedDate] = useState(getDefaultDate('month'));
  const [overview, setOverview] = useState<Overview | null>(null);
  const [ranking, setRanking] = useState<ProjectRanking[]>([]);
  const [structure, setStructure] = useState<CostStructure[]>([]);
  const [time, setTime] = useState<TimeAnalysis | null>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<Record<string, string>>({});

  useEffect(() => {
    const saved = localStorage.getItem('report_insights_v2');
    if (!saved) return;
    const map = JSON.parse(saved) as Record<string, string>;
    setHistory(map);
    setAiInsight(map[`${viewMode}:${selectedDate}`] || null);
  }, []);

  useEffect(() => {
    const period = getPeriod(viewMode, selectedDate);
    setLoading(true);
    Promise.all([
      api.get<Overview>(`/reports/overview?period=${period}&type=${viewMode}`),
      api.get<ProjectRanking[]>(`/reports/project-ranking?period=${period}&type=${viewMode}`),
      api.get<CostStructure[]>(`/reports/cost-structure?period=${period}&type=${viewMode}`),
      api.get<TimeAnalysis>(`/reports/time-analysis?period=${period}&type=${viewMode}`),
    ])
      .then(([ov, pr, cs, ta]) => {
        setOverview(ov);
        setRanking(pr);
        setStructure(cs);
        setTime(ta);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    const saved = localStorage.getItem('report_insights_v2');
    if (saved) {
      const map = JSON.parse(saved) as Record<string, string>;
      setAiInsight(map[`${viewMode}:${period}`] || null);
    }
  }, [selectedDate, viewMode]);

  function handleViewChange(mode: ViewMode) {
    setViewMode(mode);
    setSelectedDate(getDefaultDate(mode));
  }

  async function handleAiInsight() {
    setAiLoading(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const message = [
        `请用中文简短分析当前${viewMode === 'day' ? '日' : viewMode === 'year' ? '年度' : '月度'}经营数据，控制在 80 字以内。`,
        `月入款/入款: ${fmtYuan(overview?.income ?? 0)}`,
        `成本: ${fmtYuan(overview?.expense ?? 0)}`,
        `利润: ${fmtYuan(overview?.profit ?? 0)}`,
        `利润率: ${overview?.margin ?? 0}%`,
        `订单: ${ranking.map((r) => `${r.name} 利润率 ${r.margin}%`).join('；')}`,
        '只给可执行建议，使用 Markdown。',
      ].join('\n');

      const res = await fetch(`${API_BASE}/llm/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message, sessionId: 'report_insight' }),
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let buffer = '';
      let result = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const event = JSON.parse(data) as { type?: string; content?: string };
            if (event.type === 'text' && event.content) result += event.content;
          } catch {}
        }
      }
      const final = result || 'AI 生成失败';
      const key = `${viewMode}:${getPeriod(viewMode, selectedDate)}`;
      const map = { ...history, [key]: final };
      setAiInsight(final);
      setHistory(map);
      localStorage.setItem('report_insights_v2', JSON.stringify(map));
    } catch {
      setAiInsight('AI 生成失败');
    } finally {
      setAiLoading(false);
    }
  }

  function getDateInputType() {
    if (viewMode === 'day') return 'date';
    if (viewMode === 'month') return 'month';
    return 'number';
  }

  const historyEntries = Object.entries(history).reverse().slice(0, 20);
  const monthlyIncome = overview?.monthlyIncome ?? overview?.income ?? 0;
  const totalCost = overview?.cost ?? overview?.expense ?? 0;

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">订单利润报表</h1>
          <p className="mt-0.5 text-xs text-slate-400">按报价、成本、利润和入款周期查看经营质量</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
            {[{ key: 'day', label: '日' }, { key: 'month', label: '月' }, { key: 'year', label: '年' }].map((item) => (
              <button key={item.key} type="button" onClick={() => handleViewChange(item.key as ViewMode)} className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-all', viewMode === item.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50')}>
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3">
            <Calendar className="h-4 w-4 text-slate-400" />
            <input type={getDateInputType()} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="border-none bg-transparent text-sm text-slate-600 outline-none [color-scheme:light]" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="入款" value={monthlyIncome} icon={TrendingUp} color="bg-emerald-50 text-emerald-600" />
        <Metric label="成本" value={totalCost} icon={TrendingDown} color="bg-rose-50 text-rose-600" />
        <Metric label="利润" value={overview?.profit ?? 0} icon={DollarSign} color="bg-indigo-50 text-indigo-600" />
        <Metric label="利润率" value={`${overview?.margin ?? 0}%`} icon={PieChart} color="bg-amber-50 text-amber-600" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">订单利润排行</h2>
          {ranking.length === 0 ? <p className="py-6 text-center text-xs text-slate-400">暂无订单数据</p> : (
            <div className="space-y-3">
              {ranking.map((item, index) => {
                const quote = item.quote ?? item.budget ?? 0;
                const costPercent = quote > 0 ? Math.round((item.cost / quote) * 100) : 0;
                return (
                  <div key={item.id}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate font-medium text-slate-700">{item.name}</span>
                      <span className={cn('shrink-0 font-mono', item.profit >= 0 ? 'text-emerald-600' : 'text-red-500')}>{fmtYuan(item.profit)} · {item.margin}%</span>
                    </div>
                    <div className="mb-1 flex justify-between text-[11px] text-slate-400">
                      <span>报价 {fmtYuan(quote)}</span>
                      <span>成本 {fmtYuan(item.cost)} · {costPercent}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className={cn('h-full rounded-full', item.profit < 0 ? 'bg-red-400' : barColors[index % barColors.length])} style={{ width: `${Math.max(4, Math.min(100, costPercent))}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">成本结构</h2>
          {structure.length === 0 ? <p className="py-6 text-center text-xs text-slate-400">暂无成本记录</p> : (
            <div className="space-y-3">
              {structure.map((item) => (
                <div key={item.category}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-slate-600">{item.category}</span>
                    <span className="font-mono text-slate-500">{fmtYuan(item.amount)} · {item.percent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${item.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">工时分布</h2>
          {!time || time.byProject.length === 0 ? <p className="py-6 text-center text-xs text-slate-400">暂无工时记录</p> : (
            <div>
              <div className="mb-3 flex items-center gap-4 text-xs text-slate-500">
                <span>合计 <span className="font-mono font-bold text-slate-700">{time.totalHours}h</span></span>
                <span>日均 <span className="font-mono font-bold text-slate-700">{time.avgPerDay}h</span></span>
              </div>
              <div className="flex h-4 overflow-hidden rounded-full bg-slate-100">
                {time.byProject.map((project, index) => (
                  <div key={project.project} className={cn('h-full', barColors[index % barColors.length])} style={{ width: `${(project.hours / Math.max(time.totalHours, 1)) * 100}%` }} title={`${project.project}: ${project.hours}h`} />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                {time.byProject.map((project, index) => (
                  <div key={project.project} className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className={cn('h-2.5 w-2.5 rounded-full', barColors[index % barColors.length])} />{project.project} {project.hours}h
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-indigo-700">AI 经营建议</span>
              {historyEntries.length > 0 && (
                <button type="button" onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-500">
                  <History className="h-3.5 w-3.5" />{historyEntries.length} 条
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {aiInsight && (
                <button type="button" onClick={() => {
                  const key = `${viewMode}:${getPeriod(viewMode, selectedDate)}`;
                  const map = { ...history };
                  delete map[key];
                  setHistory(map);
                  setAiInsight(null);
                  localStorage.setItem('report_insights_v2', JSON.stringify(map));
                }} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50">
                  <X className="mr-1 inline h-3.5 w-3.5" />清除
                </button>
              )}
              <button type="button" onClick={handleAiInsight} disabled={aiLoading} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lightbulb className="h-3.5 w-3.5" />}{aiInsight ? '重新生成' : 'AI 分析'}
              </button>
            </div>
          </div>

          {showHistory && (
            <div className="mb-3 max-h-40 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3">
              {historyEntries.map(([key, value]) => (
                <button key={key} type="button" onClick={() => { setAiInsight(value); setShowHistory(false); }} className="block w-full rounded px-2 py-1 text-left text-xs text-slate-500 transition-colors hover:bg-slate-50">
                  <span className="mr-2 font-medium text-indigo-500">[{key}]</span>{value.slice(0, 60)}{value.length > 60 ? '...' : ''}
                </button>
              ))}
            </div>
          )}

          {aiInsight ? <div className="prose prose-sm max-w-none text-sm leading-relaxed text-slate-600"><MarkdownRenderer content={aiInsight} /></div> : <p className="text-sm text-slate-400">生成当前时段的订单利润和成本建议</p>}
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: typeof TrendingUp; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-extrabold text-slate-900">{typeof value === 'number' ? fmtYuan(value) : value}</p>
      <div className={cn('mt-2 inline-flex rounded-lg p-1.5', color)}><Icon className="h-4 w-4" /></div>
    </div>
  );
}