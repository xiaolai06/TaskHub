'use client';

import { useState, useMemo } from 'react';
import {
  CheckCircle, XCircle, MinusCircle, Clock, Loader2,
  Activity, TrendingUp, AlertTriangle, SkipForward,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { useAllJobHistory, type AllJobExecutionEntry } from '@/hooks/useCronJobs';
import { timeAgo, formatDuration, EXEC_STATUS_CONFIG } from './cron-utils';

const STATUS_ICONS: Record<string, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  skipped: MinusCircle,
};

type StatusFilter = 'all' | 'success' | 'error' | 'skipped';
type TimeFilter = 'all' | '1h' | '24h' | '7d' | 'custom';

const TIME_OPTIONS: { value: TimeFilter; label: string }[] = [
  { value: 'all', label: '全部时间' },
  { value: '1h', label: '最近 1 小时' },
  { value: '24h', label: '最近 24 小时' },
  { value: '7d', label: '最近 7 天' },
  { value: 'custom', label: '自定义时间段' },
];

// ═══ 仪表盘风格统计卡片 ═══

function StatCard({
  icon: Icon, label, value, toneClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  toneClass: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm transition-all duration-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xs-plus text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{value}</p>
        </div>
        <div className={cn('rounded-lg p-2', toneClass)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

// ═══ 主组件 ═══

export function GlobalExecutionHistory() {
  const { data: history, isLoading } = useAllJobHistory(100);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // 统计（基于全量数据）
  const stats = useMemo(() => {
    if (!history) return { total: 0, success: 0, error: 0, skipped: 0 };
    return {
      total: history.length,
      success: history.filter(e => e.status === 'success').length,
      error: history.filter(e => e.status === 'error').length,
      skipped: history.filter(e => e.status === 'skipped').length,
    };
  }, [history]);

  // 筛选
  const filtered = useMemo(() => {
    if (!history) return [];
    let list = history;

    // 状态筛选
    if (statusFilter !== 'all') {
      list = list.filter(e => e.status === statusFilter);
    }

    // 时间筛选
    if (timeFilter === 'custom') {
      if (customFrom) list = list.filter(e => new Date(e.executedAt).getTime() >= new Date(customFrom).getTime());
      if (customTo) {
        const toEnd = new Date(customTo);
        toEnd.setHours(23, 59, 59, 999);
        list = list.filter(e => new Date(e.executedAt).getTime() <= toEnd.getTime());
      }
    } else if (timeFilter !== 'all') {
      const now = Date.now();
      const ms = timeFilter === '1h' ? 3600000 : timeFilter === '24h' ? 86400000 : 604800000;
      list = list.filter(e => now - new Date(e.executedAt).getTime() < ms);
    }

    return list;
  }, [history, statusFilter, timeFilter, customFrom, customTo]);

  return (
    <div className="space-y-4">
      {/* ═══ 4 个统计卡片 ═══ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Activity} label="总执行次数" value={stats.total} toneClass="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400" />
        <StatCard icon={TrendingUp} label="成功" value={stats.success} toneClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400" />
        <StatCard icon={AlertTriangle} label="失败" value={stats.error} toneClass="bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400" />
        <StatCard icon={SkipForward} label="跳过" value={stats.skipped} toneClass="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400" />
      </div>

      {/* ═══ 筛选栏 ═══ */}
      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter((v || 'all') as StatusFilter)}>
          <SelectTrigger className="w-[110px] h-8 text-xs bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="success">成功</SelectItem>
            <SelectItem value="error">失败</SelectItem>
            <SelectItem value="skipped">跳过</SelectItem>
          </SelectContent>
        </Select>
        <Select value={timeFilter} onValueChange={(v) => setTimeFilter((v || 'all') as TimeFilter)}>
          <SelectTrigger className="w-[130px] h-8 text-xs bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {timeFilter === 'custom' && (
          <div className="flex items-center gap-2">
            <DatePicker value={customFrom} onChange={setCustomFrom} placeholder="开始日期" className="h-8 w-36 text-xs" />
            <DatePicker value={customTo} onChange={setCustomTo} placeholder="结束日期" className="h-8 w-36 text-xs" />
          </div>
        )}
        <span className="ml-auto text-2xs text-muted-foreground">{filtered.length} 条记录</span>
      </div>

      {/* ═══ 历史列表 ═══ */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Clock className="h-8 w-8 text-muted-foreground/30" />
          <p className="mt-2 text-sm">暂无执行记录</p>
          <p className="text-xs text-muted-foreground/50">任务执行后会自动记录在这里</p>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="rounded-xl border border-border bg-card divide-y divide-border/40">
          {filtered.map(entry => {
            const cfg = EXEC_STATUS_CONFIG[entry.status as keyof typeof EXEC_STATUS_CONFIG] || EXEC_STATUS_CONFIG.skipped;
            const Icon = STATUS_ICONS[entry.status] || MinusCircle;
            return (
              <div key={entry.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                <div className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full', cfg.bg)}>
                  <Icon className={cn('h-3.5 w-3.5', cfg.cls)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{entry.jobName}</span>
                    <span className={cn('rounded-full px-1.5 py-0.5 text-2xs font-medium',
                      entry.status === 'success' ? 'bg-emerald-50 text-emerald-600' :
                      entry.status === 'error' ? 'bg-red-50 text-red-500' : 'bg-muted text-muted-foreground')}>
                      {cfg.label}
                    </span>
                    {entry.durationMs != null && (
                      <span className="flex items-center gap-0.5 text-2xs text-muted-foreground/60">
                        <Clock className="h-2.5 w-2.5" />{formatDuration(entry.durationMs)}
                      </span>
                    )}
                  </div>
                  {entry.result && <p className="mt-0.5 text-xs text-muted-foreground/70 truncate">{entry.result}</p>}
                  {entry.error && <p className="mt-0.5 text-xs text-red-400/80 truncate">{entry.error}</p>}
                </div>
                <span className="shrink-0 text-2xs text-muted-foreground/50">{timeAgo(entry.executedAt)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
