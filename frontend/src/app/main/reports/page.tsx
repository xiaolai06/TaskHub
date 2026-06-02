'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Loader2, TrendingUp, TrendingDown, DollarSign, PieChart, Clock, Lightbulb, Calendar, History, X } from 'lucide-react';
import { MarkdownRenderer } from '@/components/features/ai/MarkdownRenderer';

interface Overview { income: number; expense: number; profit: number; margin: number; period: string; type: string; }
interface ProjectRanking { id: string; name: string; budget: number; cost: number; profit: number; margin: number; }
interface CostStructure { category: string; amount: number; percent: number; }
interface TimeAnalysis { byProject: { project: string; hours: number }[]; totalHours: number; avgPerDay: number; }

function fmtYuan(fen: number): string {
  const y = fen / 100;
  return y >= 10000 ? `¥${(y / 10000).toFixed(1)}w` : `¥${y.toLocaleString()}`;
}

const barColors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-violet-500'];

function getDefaultDate(mode: 'day' | 'month' | 'year'): string {
  const n = new Date();
  if (mode === 'day') return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  if (mode === 'year') return `${n.getFullYear()}`;
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

export default function ReportsPage() {
  const [viewMode, setViewMode] = useState<'day' | 'month' | 'year'>('month');
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

  // 加载缓存
  useEffect(() => {
    const saved = localStorage.getItem('report_insights_v2');
    if (saved) {
      const map = JSON.parse(saved) as Record<string, string>;
      setHistory(map);
      const key = `${viewMode}:${selectedDate}`;
      setAiInsight(map[key] || null);
    }
  }, []);

  // 切换视图模式时更新日期格式
  function handleViewChange(mode: 'day' | 'month' | 'year') {
    setViewMode(mode);
    setSelectedDate(getDefaultDate(mode));
  }

  // 加载数据
  useEffect(() => {
    setLoading(true);
    const type = viewMode;
    const period = viewMode === 'year' ? selectedDate.slice(0, 4) : selectedDate;
    Promise.all([
      api.get<Overview>(`/reports/overview?period=${period}&type=${type}`),
      api.get<ProjectRanking[]>(`/reports/project-ranking?period=${period}&type=${type}`),
      api.get<CostStructure[]>(`/reports/cost-structure?period=${period}&type=${type}`),
      api.get<TimeAnalysis>(`/reports/time-analysis?period=${period}&type=${type}`),
    ]).then(([ov, pr, cs, ta]) => { setOverview(ov); setRanking(pr); setStructure(cs); setTime(ta); })
      .catch(() => {}).finally(() => setLoading(false));

    // 加载该日期的 AI 缓存
    const saved = localStorage.getItem('report_insights_v2');
    if (saved) {
      const map = JSON.parse(saved) as Record<string, string>;
      const key = `${type}:${period}`;
      setAiInsight(map[key] || null);
    }
  }, [selectedDate, viewMode]);

  async function handleAiInsight() {
    setAiLoading(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
// ...
const res = await fetch(`${API_BASE}/llm/chat/stream`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          message: '用中文简短分析当前' + (viewMode === 'day' ? '今日' : viewMode === 'year' ? '年度' : '本月') + '经营数据（150字以内）。收入' + (overview ? fmtYuan(overview.income) : '?') + '，支出' + (overview ? fmtYuan(overview.expense) : '?') + '，利润率' + (overview?.margin ?? 0) + '%。项目排行：' + ranking.map(r => r.name + ' 利润率' + r.margin + '%').join('，') + '。使用Markdown格式，尽量短。',
          sessionId: 'report_insight',
        }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '', result = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const d = line.slice(6);
          if (d === '[DONE]') break;
          try { const e = JSON.parse(d); if (e.type === 'text') result += e.content; } catch {}
        }
      }
      const final = result || 'AI 生成失败';
      setAiInsight(final);
      const key = viewMode + ':' + selectedDate;
      const map = { ...history, [key]: final };
      setHistory(map);
      localStorage.setItem('report_insights_v2', JSON.stringify(map));
    } catch { setAiInsight('AI 生成失败'); }
    finally { setAiLoading(false); }
  }

  function getDateInputType() {
    if (viewMode === 'day') return 'date';
    if (viewMode === 'month') return 'month';
    return 'number';
  }

  const historyKeys = Object.keys(history);
  const historyEntries = historyKeys.map(k => ({ key: k, val: history[k] })).reverse().slice(0, 20);

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* 视图切换 + 日期 */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
          {[{ key: 'day', label: '日' }, { key: 'month', label: '月' }, { key: 'year', label: '年' }].map((v) => (
            <button key={v.key} onClick={() => handleViewChange(v.key as 'day' | 'month' | 'year')}
              className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                viewMode === v.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50')}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3">
          <Calendar className="h-4 w-4 text-slate-400" />
          <input type={getDateInputType()} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
            className="border-none bg-transparent text-sm text-slate-600 outline-none [color-scheme:light]" />
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        {[{ label: '收入', value: overview?.income ?? 0, icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600' },
          { label: '支出', value: overview?.expense ?? 0, icon: TrendingDown, color: 'bg-rose-50 text-rose-600' },
          { label: '毛利', value: overview?.profit ?? 0, icon: DollarSign, color: 'bg-indigo-50 text-indigo-600' },
          { label: '利润率', value: `${overview?.margin ?? 0}%`, icon: PieChart, color: 'bg-amber-50 text-amber-600' },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className="mt-1 text-xl font-extrabold text-slate-900">{typeof c.value === 'number' ? fmtYuan(c.value) : c.value}</p>
            <div className={cn('mt-2 inline-flex rounded-lg p-1.5', c.color)}><c.icon className="h-4 w-4" /></div>
          </div>
        ))}
      </div>

      {/* 项目排行 + 支出结构 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">项目利润排行</h3>
          {ranking.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">暂无数据</p>
          ) : (
            <div className="space-y-3">
              {ranking.map((r, i) => (
                <div key={r.id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700">{r.name}</span>
                    <span className={cn('font-mono', r.margin >= 30 ? 'text-emerald-600' : r.margin >= 0 ? 'text-amber-600' : 'text-red-500')}>
                      {fmtYuan(r.profit)} · {r.margin}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={cn('h-full rounded-full', barColors[i % 6])} style={{ width: `${Math.max(0, Math.min(100, r.margin + 20))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">支出结构</h3>
          {structure.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">暂无支出</p>
          ) : (
            <div className="space-y-3">
              {structure.map((s) => (
                <div key={s.category}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-600">{s.category}</span>
                    <span className="font-mono text-slate-500">{fmtYuan(s.amount)} · {s.percent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${s.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 工时分析 + 项目统计 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">工时分析</h3>
          {!time || time.byProject.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">暂无工时记录</p>
          ) : (
            <div>
              <div className="flex items-center gap-4 mb-3 text-xs text-slate-500">
                <span>合计 <span className="font-mono font-bold text-slate-700">{time.totalHours}h</span></span>
                <span>日均 <span className="font-mono font-bold text-slate-700">{time.avgPerDay}h</span></span>
              </div>
              <div className="flex h-4 overflow-hidden rounded-full bg-slate-100">
                {time.byProject.map((p, i) => {
                  const w = (p.hours / time.totalHours) * 100;
                  return <div key={p.project} className={cn('h-full', barColors[i % 6])} style={{ width: `${w}%` }} title={`${p.project}: ${p.hours}h`} />;
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                {time.byProject.map((p, i) => (
                  <div key={p.project} className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className={cn('h-2.5 w-2.5 rounded-full', barColors[i % 6])} />{p.project} {p.hours}h
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">项目统计</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-indigo-50 p-3 text-center">
              <p className="text-xs text-indigo-500">活跃项目</p>
              <p className="mt-1 text-xl font-bold text-indigo-700">{ranking.filter(r => r.margin > -100).length}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3 text-center">
              <p className="text-xs text-emerald-500">盈利项目</p>
              <p className="mt-1 text-xl font-bold text-emerald-700">{ranking.filter(r => r.margin > 0).length}</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3 text-center">
              <p className="text-xs text-amber-500">总任务</p>
              <p className="mt-1 text-xl font-bold text-amber-700">{time?.byProject.length || 0}</p>
            </div>
            <div className="rounded-lg bg-rose-50 p-3 text-center">
              <p className="text-xs text-rose-500">总工时</p>
              <p className="mt-1 text-xl font-bold text-rose-700">{time?.totalHours || 0}h</p>
            </div>
          </div>
        </div>
      </div>

      {/* AI 解读（置底） */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-indigo-700">AI 解读</span>
            {historyEntries.length > 0 && (
              <button onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-500">
                <History className="h-3.5 w-3.5" />{historyEntries.length} 条
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {aiInsight && (
              <button onClick={() => {
                const key = viewMode + ':' + selectedDate;
                const map = { ...history }; delete map[key];
                setHistory(map); setAiInsight(null);
                localStorage.setItem('report_insights_v2', JSON.stringify(map));
              }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50">
                <X className="h-3.5 w-3.5 mr-1 inline" />清除
              </button>
            )}
            <button onClick={handleAiInsight} disabled={aiLoading}
              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lightbulb className="h-3.5 w-3.5" />}
              {aiInsight ? '重新生成' : 'AI 分析'}
            </button>
          </div>
        </div>

        {showHistory && (
          <div className="mb-3 max-h-40 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3">
            {historyEntries.map((h, i) => (
              <button key={i} onClick={() => { setAiInsight(h.val); setShowHistory(false); }}
                className="block w-full rounded px-2 py-1 text-left text-xs text-slate-500 transition-colors hover:bg-slate-50">
                <span className="font-medium text-indigo-500 mr-2">[{h.key}]</span>
                {h.val.slice(0, 60)}{h.val.length > 60 ? '...' : ''}
              </button>
            ))}
          </div>
        )}

        {aiInsight ? (
          <div className="prose prose-sm max-w-none text-sm leading-relaxed text-slate-600">
            <MarkdownRenderer content={aiInsight} />
          </div>
        ) : (
          <p className="text-sm text-slate-400">点击 AI 分析生成当前时段解读</p>
        )}
      </div>
    </div>
  );
}
