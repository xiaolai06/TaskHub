'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ListChecks, Clock, AlertTriangle, CalendarX, CalendarDays,
  BarChart3, Timer,
} from 'lucide-react';
import type { ScheduleData, DelayedTask, ConflictData } from '@/hooks/useSchedule';

// ======================== 统计卡片（带悬浮详情） ========================

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  variant?: 'default' | 'warning' | 'danger' | 'success';
  details?: { label: string; value: string | number; danger?: boolean }[];
}

function StatCard({ icon, label, value, sub, variant = 'default', details }: StatCardProps) {
  const [hovered, setHovered] = useState(false);
  const colorMap = {
    default: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40',
    warning: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40',
    danger: 'text-red-500 bg-red-50 dark:bg-red-950/40',
    success: 'text-green-500 bg-green-50 dark:bg-green-950/40',
  };

  return (
    <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <Card className="shadow-sm cursor-default">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold text-foreground">{value}</p>
              {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
            </div>
            <div className={`p-2 rounded-lg ${colorMap[variant]}`}>{icon}</div>
          </div>
        </CardContent>
      </Card>

      {/* 悬浮详情弹窗 */}
      {hovered && details && details.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-border bg-card p-3 shadow-lg animate-in fade-in-0 zoom-in-95 duration-150">
          <p className="mb-2 text-xs font-medium text-foreground">{label}详情</p>
          <div className="space-y-1.5">
            {details.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate mr-2">{d.label}</span>
                <span className={d.danger ? 'text-red-500 font-medium' : 'text-foreground font-medium'}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ======================== 工时分布柱状图 ========================

function WorkloadBar({ dailyWorkload }: { dailyWorkload: ScheduleData['dailyWorkload'] }) {
  if (dailyWorkload.length === 0) return null;

  const maxHours = Math.max(...dailyWorkload.map((d) => d.hours), 8);
  const displayDays = dailyWorkload.slice(0, 14);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-foreground/70 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-indigo-400" />
          每日工时分布
          <span className="text-xs text-muted-foreground font-normal">（前 14 天）</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-end gap-1 h-28">
          {displayDays.map((day) => {
            const heightPct = maxHours > 0 ? (day.hours / maxHours) * 100 : 0;
            const date = new Date(day.date + 'T00:00:00');
            const dayNum = date.getDate();
            const isOverloaded = day.isOverloaded;

            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group">
                <span className={`text-[9px] font-mono opacity-0 group-hover:opacity-100 transition-opacity ${isOverloaded ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
                  {day.hours}h
                </span>
                <div className="w-full relative" style={{ height: '100px' }}>
                  <div
                    className={`absolute bottom-0 w-full rounded-t-sm transition-all ${isOverloaded ? 'bg-red-400' : day.hours > 6 ? 'bg-amber-400' : 'bg-indigo-400'}`}
                    style={{ height: `${Math.max(heightPct, 4)}%` }}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground">{dayNum}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-400" />正常</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />较满</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />超载</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ======================== 导出组件 ========================

interface ScheduleStatsProps {
  schedule: ScheduleData;
  delays: DelayedTask[];
  conflicts: ConflictData | undefined;
}

export function ScheduleStats({ schedule, delays, conflicts }: ScheduleStatsProps) {
  const { summary, dailyWorkload } = schedule;

  const workDays = dailyWorkload.filter(d => d.hours > 0).length;
  const avgHours = workDays > 0 ? Math.round((summary.totalHours / workDays) * 10) / 10 : 0;
  const projectEnd = summary.projectEnd;
  const daysLeft = projectEnd
    ? Math.max(0, Math.ceil((new Date(projectEnd).getTime() - Date.now()) / 86400000))
    : null;

  // 待排任务详情：按优先级分组
  const taskDetails = schedule.tasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.priority] = (acc[t.priority] || 0) + 1;
    return acc;
  }, {});
  const priorityLabel: Record<string, string> = { URGENT: '紧急', HIGH: '高', MEDIUM: '中', LOW: '低' };

  // 延期任务详情
  const delayDetails = delays.length > 0
    ? delays.slice(0, 5).map(t => ({ label: t.title, value: `+${t.overdueDays}天`, danger: true }))
    : [{ label: '暂无延期任务', value: '✓' }];

  // 冲突天详情
  const conflictDetails = (conflicts?.overloadedDays ?? []).slice(0, 5).map(c => ({
    label: c.date,
    value: `${c.hours}h`,
    danger: c.isOverloaded,
  }));

  return (
    <div className="space-y-4">
      {/* 统计卡片 2×3 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard
          icon={<ListChecks className="h-5 w-5" />}
          label="待排任务"
          value={summary.totalTasks}
          sub={`${summary.totalHours}h 总工时`}
          variant="default"
          details={Object.entries(taskDetails).map(([k, v]) => ({ label: priorityLabel[k] || k, value: `${v} 个` }))}
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="排期跨度"
          value={summary.projectStart && summary.projectEnd
            ? `${summary.projectStart.slice(5)} ~ ${summary.projectEnd.slice(5)}`
            : '—'}
          sub={workDays > 0 ? `${workDays} 个工作日` : '暂无排期'}
          variant="default"
          details={dailyWorkload.slice(0, 7).map(d => ({ label: d.date, value: `${d.hours}h`, danger: d.isOverloaded }))}
        />
        <StatCard
          icon={<BarChart3 className="h-5 w-5" />}
          label="每日均工时"
          value={`${avgHours}h`}
          sub={avgHours > 8 ? '偏高，注意休息' : avgHours > 6 ? '较满' : '正常'}
          variant={avgHours > 8 ? 'warning' : 'default'}
          details={[
            { label: '总工时', value: `${summary.totalHours}h` },
            { label: '工作日', value: `${workDays} 天` },
            { label: '日上限', value: `${dailyWorkload.length > 0 ? Math.max(...dailyWorkload.map(d => d.hours)) : 0}h`, danger: dailyWorkload.some(d => d.isOverloaded) },
          ]}
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="延期任务"
          value={summary.delayedTasks}
          sub={summary.delayedTasks > 0 ? '需要关注' : '一切正常'}
          variant={summary.delayedTasks > 0 ? 'danger' : 'success'}
          details={delayDetails}
        />
        <StatCard
          icon={<CalendarX className="h-5 w-5" />}
          label="冲突天数"
          value={summary.conflictDays}
          sub={summary.conflictDays > 0 ? '工时超限' : '无冲突'}
          variant={summary.conflictDays > 0 ? 'warning' : 'success'}
          details={conflictDetails.length > 0 ? conflictDetails : [{ label: '无冲突天', value: '✓' }]}
        />
        <StatCard
          icon={<Timer className="h-5 w-5" />}
          label="预计完成"
          value={daysLeft !== null ? `${daysLeft} 天` : '—'}
          sub={projectEnd ? `目标 ${projectEnd}` : '未设定截止'}
          variant={daysLeft !== null && daysLeft <= 3 ? 'danger' : daysLeft !== null && daysLeft <= 7 ? 'warning' : 'default'}
          details={[
            { label: '项目开始', value: summary.projectStart || '—' },
            { label: '项目截止', value: summary.projectEnd || '—' },
            { label: '剩余天数', value: daysLeft !== null ? `${daysLeft} 天` : '—', danger: daysLeft !== null && daysLeft <= 3 },
          ]}
        />
      </div>

      {/* 工时分布图 */}
      <WorkloadBar dailyWorkload={dailyWorkload} />
    </div>
  );
}
