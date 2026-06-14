'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Loader2, TrendingUp, TrendingDown, DollarSign, PieChart, Lightbulb, CalendarIcon, AlertTriangle } from 'lucide-react';
import { MarkdownRenderer } from '@/components/features/ai/MarkdownRenderer';
import { DatePicker } from '@/components/ui/date-picker';

interface Overview { income: number; expense: number; profit: number; margin: number; period: string; type: string; }
interface ProjectRanking { id: string; name: string; budget: number; cost: number; profit: number; margin: number; }
interface CostStructure { category: string; amount: number; percent: number; }
interface TimeAnalysis { byProject: { project: string; hours: number }[]; totalHours: number; avgPerDay: number; }

function fmtYuan(fen: number): string {
  const y = fen / 100;
  return y >= 10000 ? `¥${(y / 10000).toFixed(1)}w` : `¥${y.toLocaleString()}`;
}

const barColors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-violet-500'];

type PeriodPreset = 'day' | 'month' | 'year';

const PERIOD_PRESETS: { key: PeriodPreset; label: string }[] = [
  { key: 'day', label: '今日' },
  { key: 'month', label: '本月' },
  { key: 'year', label: '本年' },
];

function getDefaultDate(mode: PeriodPreset): string {
  const n = new Date();
  if (mode === 'day') return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  if (mode === 'year') return `${n.getFullYear()}`;
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

export default function ReportsPage() {
  const [preset, setPreset] = useState<PeriodPreset>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [ranking, setRanking] = useState<ProjectRanking[]>([]);
  const [structure, setStructure] = useState<CostStructure[]>([]);
  const [time, setTime] = useState<TimeAnalysis | null>(null);

  // 计算实际的 viewMode 和 selectedDate
  const viewMode: PeriodPreset = showCustom ? 'day' : preset;
  const selectedDate = showCustom ? customStart : getDefaultDate(preset);

  function handlePresetChange(p: PeriodPreset) {
    setPreset(p);
    setShowCustom(false);
    setCustomStart('');
    setCustomEnd('');
    setAiInsight(null);
  }

  function handleCustomToggle() {
    const next = !showCustom;
    setShowCustom(next);
    if (next) {
      const n = new Date();
      const today = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
      setCustomStart(today);
      setCustomEnd(today);
    }
    setAiInsight(null);
  }

  // 加载数据
  useEffect(() => {
    if (showCustom && !customStart) return;
    setLoading(true);
    setError(false);
    const type = viewMode;
    const period = viewMode === 'year' ? selectedDate.slice(0, 4) : selectedDate;
    const qs = `period=${period}&type=${type}${showCustom && customEnd ? `&endDate=${customEnd}` : ''}`;
    Promise.all([
      api.get<Overview>(`/reports/overview?${qs}`),
      api.get<ProjectRanking[]>(`/reports/project-ranking?${qs}`),
      api.get<CostStructure[]>(`/reports/cost-structure?${qs}`),
      api.get<TimeAnalysis>(`/reports/time-analysis?${qs}`),
    ]).then(([ov, pr, cs, ta]) => { setOverview(ov); setRanking(pr); setStructure(cs); setTime(ta); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
    setAiInsight(null);
  }, [selectedDate, viewMode, showCustom, customStart, customEnd]);

  async function handleAiInsight() {
    setAiLoading(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const res = await fetch(`${API_BASE}/llm/chat/stream`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          message: '用中文简短分析当前' + (viewMode === 'day' ? '今日' : viewMode === 'year' ? '年度' : '本月') + '经营数据（150字以内）。收入' + (overview ? fmtYuan(overview.income) : '?') + '，支出' + (overview ? fmtYuan(overview.expense) : '?') + '，利润率' + (overview?.margin ?? 0) + '%。项目排行：' + ranking.map(r => r.name + ' 利润率' + r.margin + '%').join('，') + '。使用Markdown格式，尽量短。',
          sessionId: 'report_insight',
        }),
      });
      if (!res.ok) throw new Error(`请求失败 (${res.status})`);
      if (!res.body) throw new Error('响应为空');
      const reader = res.body.getReader();
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
    } catch { setAiInsight('AI 生成失败'); }
    finally { setAiLoading(false); }
  }

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>;
  if (error) return (
    <div className="flex flex-col items-center justify-center py-32">
      <AlertTriangle className="h-10 w-10 text-red-300" />
      <p className="mt-4 text-sm text-red-500">加载经营数据失败</p>
      <button onClick={() => window.location.reload()} className="mt-3 text-sm font-medium text-indigo-600 hover:underline">重试</button>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5 page-enter">
      {/* 视图切换 + 日期 */}
      <div className="flex flex-wrap items-center gap-3">
        {/* 时段预设 */}
        <div className="flex h-9 items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
          {PERIOD_PRESETS.map((p) => (
            <button key={p.key} onClick={() => handlePresetChange(p.key)}
              className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                preset === p.key && !showCustom ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-accent')}>
              {p.label}
            </button>
          ))}
        </div>

        {/* 自定义日期按钮 */}
        <button onClick={handleCustomToggle}
          className={cn('flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-all',
            showCustom ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80')}>
          <CalendarIcon className="h-4 w-4" />
          自定义
        </button>

        {/* 自定义日期选择器 */}
        {showCustom && (
          <>
            <DatePicker
              value={customStart}
              onChange={(v) => { setCustomStart(v); setAiInsight(null); }}
            />
            <DatePicker
              value={customEnd || customStart}
              onChange={(v) => { setCustomEnd(v); setAiInsight(null); }}
            />
          </>
        )}
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        {[{ label: '收入', value: overview?.income ?? 0, icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600' },
          { label: '支出', value: overview?.expense ?? 0, icon: TrendingDown, color: 'bg-rose-50 text-rose-600' },
          { label: '毛利', value: overview?.profit ?? 0, icon: DollarSign, color: 'bg-indigo-50 text-indigo-600' },
          { label: '利润率', value: `${overview?.margin ?? 0}%`, icon: PieChart, color: 'bg-amber-50 text-amber-600' },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-xl font-extrabold text-foreground">{typeof c.value === 'number' ? fmtYuan(c.value) : c.value}</p>
            <div className={cn('mt-2 inline-flex rounded-lg p-1.5', c.color)}><c.icon className="h-4 w-4" /></div>
          </div>
        ))}
      </div>

      {/* 项目排行 + 支出结构 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-foreground/80">项目利润排行</h3>
          {ranking.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">暂无数据</p>
          ) : (
            <div className="space-y-3">
              {ranking.map((r, i) => (
                <div key={r.id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-foreground/80">{r.name}</span>
                    <span className={cn('font-mono', r.margin >= 30 ? 'text-emerald-600' : r.margin >= 0 ? 'text-amber-600' : 'text-red-500')}>
                      {fmtYuan(r.profit)} · {r.margin}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className={cn('h-full rounded-full progress-animate', barColors[i % 6])} style={{ width: `${Math.max(0, Math.min(100, r.margin + 20))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-foreground/80">支出结构</h3>
          {structure.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">暂无支出</p>
          ) : (
            <div className="space-y-3">
              {structure.map((s) => (
                <div key={s.category}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-foreground/70">{s.category}</span>
                    <span className="font-mono text-muted-foreground">{fmtYuan(s.amount)} · {s.percent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-amber-400 progress-animate" style={{ width: `${s.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 工时分析 */}
      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-foreground/80">工时分析</h3>
        {!time || time.byProject.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">暂无工时记录</p>
        ) : (
          <div>
            <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span>合计 <span className="font-mono font-bold text-foreground/80">{time.totalHours}h</span></span>
              <span>日均 <span className="font-mono font-bold text-foreground/80">{time.avgPerDay}h</span></span>
              <span>项目数 <span className="font-mono font-bold text-foreground/80">{time.byProject.length}</span></span>
            </div>
            <div className="flex h-4 overflow-hidden rounded-full bg-muted">
              {time.byProject.map((p, i) => {
                const w = (p.hours / time.totalHours) * 100;
                return <div key={p.project} className={cn('h-full', barColors[i % 6])} style={{ width: `${w}%` }} title={`${p.project}: ${p.hours}h`} />;
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              {time.byProject.map((p, i) => (
                <div key={p.project} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn('h-2.5 w-2.5 rounded-full', barColors[i % 6])} />{p.project} {p.hours}h
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI 解读（置底） */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-indigo-700">AI 解读</span>
          <div className="flex items-center gap-2">
            {aiInsight ? (
              <button
                onClick={() => setAiInsight(null)}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
              >
                清除
              </button>
            ) : null}
            <button onClick={handleAiInsight} disabled={aiLoading}
              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
              {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lightbulb className="h-3.5 w-3.5" />}
              {aiInsight ? '重新生成' : 'AI 分析'}
            </button>
          </div>
        </div>

        {aiInsight ? (
          <div className="prose prose-sm max-w-none text-sm leading-relaxed text-foreground/70">
            <MarkdownRenderer content={aiInsight} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">点击 AI 分析生成当前时段解读</p>
        )}
      </div>
    </div>
  );
}
