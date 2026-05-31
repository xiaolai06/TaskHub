'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ListChecks,
  Clock,
  AlertTriangle,
  CalendarX,
  CalendarDays,
  TrendingUp,
} from 'lucide-react';
import type { ScheduleData, DelayedTask, ConflictData } from '@/hooks/useSchedule';

// ======================== 统计卡片 ========================

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  variant?: 'default' | 'warning' | 'danger' | 'success';
}

function StatCard({ icon, label, value, sub, variant = 'default' }: StatCardProps) {
  const colorMap = {
    default: 'text-indigo-500 bg-indigo-50',
    warning: 'text-amber-500 bg-amber-50',
    danger: 'text-red-500 bg-red-50',
    success: 'text-green-500 bg-green-50',
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
            {sub && <p className="text-xs text-slate-400">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg ${colorMap[variant]}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ======================== 工时分布柱状图（简化版） ========================

function WorkloadBar({ dailyWorkload }: { dailyWorkload: ScheduleData['dailyWorkload'] }) {
  if (dailyWorkload.length === 0) return null;

  const maxHours = Math.max(...dailyWorkload.map((d) => d.hours), 8);
  const displayDays = dailyWorkload.slice(0, 14); // 最多显示 14 天

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-indigo-400" />
          每日工时分布
          <span className="text-xs text-slate-400 font-normal">（前 14 天）</span>
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
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center gap-1 group"
              >
                {/* 数值 */}
                <span
                  className={`text-[9px] font-mono opacity-0 group-hover:opacity-100 transition-opacity ${
                    isOverloaded ? 'text-red-500 font-bold' : 'text-slate-500'
                  }`}
                >
                  {day.hours}h
                </span>
                {/* 柱子 */}
                <div className="w-full relative" style={{ height: '100px' }}>
                  <div
                    className={`absolute bottom-0 w-full rounded-t-sm transition-all ${
                      isOverloaded
                        ? 'bg-red-400'
                        : day.hours > 6
                          ? 'bg-amber-400'
                          : 'bg-indigo-400'
                    }`}
                    style={{ height: `${Math.max(heightPct, 4)}%` }}
                  />
                </div>
                {/* 日期 */}
                <span className="text-[9px] text-slate-400">{dayNum}</span>
              </div>
            );
          })}
        </div>
        {/* 图例 */}
        <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />正常
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" />较满
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400" />超载
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ======================== 延期任务列表 ========================

function DelayedTaskList({ delays }: { delays: DelayedTask[] }) {
  if (delays.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-green-400" />
            延期任务
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-xs text-green-500 py-4 text-center">
            暂无延期任务，继续保持！
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          延期任务
          <span className="text-xs text-red-400 font-normal">（{delays.length} 个）</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {delays.slice(0, 5).map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between py-1.5 text-xs border-b last:border-b-0"
            >
              <span className="text-slate-700 truncate mr-2">{task.title}</span>
              <span className="text-red-500 font-mono flex-shrink-0">
                +{task.overdueDays} 天
              </span>
            </div>
          ))}
          {delays.length > 5 && (
            <p className="text-[10px] text-slate-400 text-center pt-1">
              还有 {delays.length - 5} 个延期任务...
            </p>
          )}
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

  return (
    <div className="space-y-4">
      {/* 统计卡片行 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<ListChecks className="h-5 w-5" />}
          label="待排任务"
          value={summary.totalTasks}
          sub={`${summary.totalHours} 小时总工时`}
          variant="default"
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="总工时"
          value={`${summary.totalHours}h`}
          sub={summary.projectStart && summary.projectEnd
            ? `${summary.projectStart} ~ ${summary.projectEnd}`
            : '暂无排期'}
          variant="default"
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="延期任务"
          value={summary.delayedTasks}
          sub={summary.delayedTasks > 0 ? '需要关注' : '一切正常'}
          variant={summary.delayedTasks > 0 ? 'danger' : 'success'}
        />
        <StatCard
          icon={<CalendarX className="h-5 w-5" />}
          label="冲突天数"
          value={summary.conflictDays}
          sub={summary.conflictDays > 0 ? '工时超限' : '无冲突'}
          variant={summary.conflictDays > 0 ? 'warning' : 'success'}
        />
      </div>

      {/* 工时分布 + 延期列表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WorkloadBar dailyWorkload={dailyWorkload} />
        <DelayedTaskList delays={delays} />
      </div>
    </div>
  );
}
