'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ChevronRight, FolderKanban, CheckCircle2, FileText, TrendingUp } from 'lucide-react';
import { StatCard } from './StatCard';
import { DonutChart } from './DonutChart';
import { VerticalBars } from './VerticalBars';
import { buildDateQuery } from './DateFilter';
import { CHART_COLORS, fmtYuan, fmtYuanRaw, SectionCard, EmptyPlaceholder, ErrorState, StatSkeleton, ChartSkeleton } from './report-utils';
import type { DateFilterValue } from './DateFilter';

// ─── Types ───

interface ProjectStats {
  activeCount: number; completedCount: number; completedInRange: number;
  budgetTotal: number; totalMargin: number;
}
interface ProjectRanking {
  id: string; name: string; budget: number; quote: number;
  received: number; cost: number; profit: number; margin: number;
}
interface ProjectDetailItem {
  id: string; name: string; type: string; status: string;
  budget: number; quote: number; received: number;
  cost: number; profit: number; margin: number;
}

// ─── Helpers ───

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: '进行中', COMPLETED: '已完成', ARCHIVED: '已归档',
};
const STATUS_COLOR: Record<string, string> = {
  ACTIVE: '#10b981', COMPLETED: '#6366f1', ARCHIVED: '#94a3b8',
};
const STATUS_BADGE_CLASS: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  COMPLETED: 'bg-indigo-50 text-indigo-700',
  ARCHIVED: 'bg-slate-100 text-slate-600',
};

// ─── 项目详情列表（弹窗用） ───

function ProjectListInPopover({ projects, status, maxVisible = 8 }: {
  projects: ProjectDetailItem[];
  status: string;
  maxVisible?: number;
}) {
  const filtered = projects.filter((p) => p.status === status);
  if (filtered.length === 0) return <p className="py-2 text-center text-muted-foreground text-[11px]">暂无项目</p>;
  return (
    <div className="space-y-0.5" style={{ maxHeight: 240, overflowY: 'auto' }}>
      {filtered.slice(0, maxVisible).map((p) => (
        <Link key={p.id} href={`/main/projects/${p.id}`}
          className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/40 transition-colors">
          <span className="flex-1 truncate text-[11px] text-foreground/80">{p.name}</span>
          <span className={cn('shrink-0 ml-2 text-[10px] font-mono font-medium',
            p.margin >= 30 ? 'text-emerald-600' : p.margin >= 10 ? 'text-amber-600' : 'text-red-500')}>
            {p.margin}%
          </span>
        </Link>
      ))}
      {filtered.length > maxVisible && <p className="pt-1 text-center text-[10px] text-muted-foreground">还有 {filtered.length - maxVisible} 个项目...</p>}
    </div>
  );
}

// ─── Component ───

interface ProjectTabProps {
  dateFilter: DateFilterValue;
}

export function ProjectTab({ dateFilter }: ProjectTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [ranking, setRanking] = useState<ProjectRanking[]>([]);
  const [details, setDetails] = useState<ProjectDetailItem[]>([]);

  const qs = buildDateQuery(dateFilter);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<ProjectStats>(`/reports/project-stats?${qs}`),
      api.get<ProjectRanking[]>(`/reports/project-ranking?${qs}`),
      api.get<ProjectDetailItem[]>(`/reports/project-detail?${qs}`),
    ]).then(([st, rk, dt]) => {
      setStats(st); setRanking(rk); setDetails(dt);
    }).catch((e) => setError(e instanceof ApiError ? e.message : '加载失败'))
      .finally(() => setLoading(false));
  }, [qs]);

  if (loading) return (
    <div className="space-y-5 animate-in fade-in-0 duration-300">
      <StatSkeleton />
      <ChartSkeleton />
    </div>
  );
  if (error) return <ErrorState message={error} />;

  // 状态分布 — 保留原始 status key
  const statusMap = new Map<string, { label: string; count: number; color: string }>();
  for (const d of details) {
    const existing = statusMap.get(d.status);
    if (existing) {
      existing.count += 1;
    } else {
      statusMap.set(d.status, {
        label: STATUS_LABEL[d.status] || d.status,
        count: 1,
        color: STATUS_COLOR[d.status] || '#94a3b8',
      });
    }
  }
  const statusEntries = Array.from(statusMap.entries());

  return (
    <div className="space-y-5 animate-in fade-in-0 duration-300">
      {/* ── 第一层 · 决策指标 ── */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon={FolderKanban} label="活跃项目" value={String(stats?.activeCount ?? 0)}
          iconBg="bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400" />
        <StatCard icon={CheckCircle2} label="已完成" value={String(stats?.completedCount ?? 0)}
          hint={stats?.completedInRange ? `本期 ${stats.completedInRange} 个` : undefined}
          iconBg="bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
        />
        <StatCard icon={FileText} label="报价合计" value={fmtYuan(stats?.budgetTotal ?? 0)}
          iconBg="bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400" />
        <StatCard icon={TrendingUp} label="总利润率" value={`${stats?.totalMargin ?? 0}%`}
          iconBg="bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400" />
      </div>

      {/* ── 第二层 · 归因分析 ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard
          title="项目利润排行"
          right={
            <Link href="/main/projects" className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              查看全部 <ChevronRight className="h-3 w-3" />
            </Link>
          }
        >
          <VerticalBars
            data={ranking.map((r, i) => ({
              name: r.name,
              value: r.profit / 100,
              color: CHART_COLORS[i % CHART_COLORS.length],
              tag: `${r.margin}%`,
              tagPositive: r.margin >= 0,
              detail: (
                <div className="space-y-0.5 text-[11px]">
                  <p className="font-medium text-foreground border-b border-border/40 pb-1.5 mb-1">{r.name}</p>
                  <div className="flex justify-between"><span className="text-muted-foreground">报价</span><span className="font-mono">{fmtYuanRaw(r.budget)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">已收</span><span className="font-mono">{fmtYuanRaw(r.received)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">成本</span><span className="font-mono">{fmtYuanRaw(r.cost)}</span></div>
                  <div className="flex justify-between pt-1 border-t border-border/30"><span className="font-medium text-foreground">利润</span><span className={cn('font-mono font-semibold', r.profit >= 0 ? 'text-emerald-600' : 'text-red-500')}>{fmtYuanRaw(r.profit)}</span></div>
                </div>
              ),
            }))}
            formatValue={(v) => `¥${Math.round(v).toLocaleString('zh-CN')}`}
          />
        </SectionCard>

        <SectionCard title="项目状态分布">
          {statusEntries.length === 0 ? (
            <EmptyPlaceholder text="暂无项目" icon="folder" />
          ) : (
            <DonutChart
              data={statusEntries.map(([status, s]) => ({
                label: s.label,
                value: s.count,
                color: s.color,
                detail: (
                  <div>
                    <div className="mb-2 flex items-center justify-between border-b border-border/40 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-[12px] font-semibold text-foreground">{s.label}</span>
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground">{s.count} 个</span>
                    </div>
                    <ProjectListInPopover projects={details} status={status} />
                  </div>
                ),
              }))}
              centerLabel="总项目"
              centerValue={String(details.length)}
            />
          )}
        </SectionCard>
      </div>

      {/* ── 第三层 · 明细表格 ── */}
      <SectionCard
        title="项目明细"
        right={
          <Link href="/main/projects" className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
            查看全部 <ChevronRight className="h-3 w-3" />
          </Link>
        }
      >
        {details.length === 0 ? (
          <EmptyPlaceholder text="暂无项目数据" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="pb-2 pr-4 text-left font-medium text-muted-foreground">项目名称</th>
                  <th className="pb-2 pr-4 text-left font-medium text-muted-foreground">类型</th>
                  <th className="pb-2 pr-4 text-left font-medium text-muted-foreground">状态</th>
                  <th className="pb-2 pr-4 text-right font-medium text-muted-foreground">报价</th>
                  <th className="pb-2 pr-4 text-right font-medium text-muted-foreground">已收</th>
                  <th className="pb-2 pr-4 text-right font-medium text-muted-foreground">成本</th>
                  <th className="pb-2 text-right font-medium text-muted-foreground">利润率</th>
                </tr>
              </thead>
              <tbody>
                {details.map((d) => (
                  <tr key={d.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 pr-4">
                      <Link href={`/main/projects/${d.id}`} className="font-medium text-foreground hover:text-indigo-600 transition-colors">
                        {d.name}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{d.type || '-'}</td>
                    <td className="py-2.5 pr-4">
                      <span className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                        STATUS_BADGE_CLASS[d.status] ?? 'bg-slate-100 text-slate-600',
                      )}>
                        {STATUS_LABEL[d.status] || d.status}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono tabular-nums">{fmtYuanRaw(d.budget)}</td>
                    <td className="py-2.5 pr-4 text-right font-mono tabular-nums">{fmtYuanRaw(d.received)}</td>
                    <td className="py-2.5 pr-4 text-right font-mono tabular-nums">{fmtYuanRaw(d.cost)}</td>
                    <td className={cn(
                      'py-2.5 text-right font-mono font-semibold tabular-nums',
                      d.margin >= 30 ? 'text-emerald-600' : d.margin >= 10 ? 'text-amber-600' : 'text-red-500',
                    )}>
                      {d.margin}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
