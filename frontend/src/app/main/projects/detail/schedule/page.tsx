'use client';

import { use } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  AlertTriangle,
  CalendarDays,
  Plus,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import {
  useSchedule,
  useDelays,
  useConflicts,
  useRefreshSchedule,
} from '@/hooks/useSchedule';
import { GanttChart } from '@/components/features/schedule/GanttChart';
import { InsertionDialog } from '@/components/features/schedule/InsertionDialog';
import { ScheduleStats } from '@/components/features/schedule/ScheduleStats';

// ======================== 页面 ========================

export default function SchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);

  const { data: schedule, isLoading, error } = useSchedule(projectId);
  const { data: delays } = useDelays(projectId);
  const { data: conflicts } = useConflicts(projectId);
  const refresh = useRefreshSchedule(projectId);

  // ========== 加载态 ==========
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm text-slate-500">正在计算排期...</p>
        </div>
      </div>
    );
  }

  // ========== 错误态 ==========
  if (error) {
    const message =
      error instanceof Error ? error.message : '加载排期数据失败';
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <AlertTriangle className="h-10 w-10 text-red-300" />
        <p className="mt-4 text-sm text-red-500">{message}</p>
        <Button variant="outline" className="mt-4" onClick={refresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          重试
        </Button>
      </div>
    );
  }

  // ========== 空状态 ==========
  if (!schedule || schedule.summary.totalTasks === 0) {
    return (
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/main/projects/${projectId}`}>
              <Button variant="ghost" size="sm" className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                返回
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">排期视图</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                查看项目任务排期、延期和冲突情况
              </p>
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex flex-col items-center justify-center py-24">
          <CalendarDays className="h-16 w-16 text-slate-200 mb-4" />
          <p className="text-lg font-medium text-slate-500">暂无排期数据</p>
          <p className="text-sm text-slate-400 mt-1">
            请先在项目中添加任务，然后再查看排期
          </p>
          <Link href={`/main/projects/${projectId}`}>
            <Button className="mt-6">
              <Plus className="h-4 w-4 mr-2" />
              去添加任务
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // ========== 正常渲染 ==========
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/main/projects/${projectId}`}>
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              返回
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">排期视图</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {schedule.summary.totalTasks} 个任务 · {schedule.summary.totalHours} 小时
              {schedule.summary.projectStart && schedule.summary.projectEnd && (
                <> · {schedule.summary.projectStart} ~ {schedule.summary.projectEnd}</>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            刷新
          </Button>
          <InsertionDialog projectId={projectId}>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              插单模拟
            </Button>
          </InsertionDialog>
        </div>
      </div>

      <Separator />

      {/* 统计面板 */}
      <ScheduleStats
        schedule={schedule}
        delays={delays ?? []}
        conflicts={conflicts}
      />

      {/* 甘特图 */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-slate-700 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-indigo-500" />
            甘特图
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <GanttChart
            tasks={schedule.tasks}
            dailyWorkload={schedule.dailyWorkload}
          />
        </CardContent>
      </Card>

      {/* 冲突详情 */}
      {conflicts && conflicts.totalConflicts > 0 && (
        <Card className="shadow-sm border-orange-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-orange-700 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              排期冲突
              <span className="text-xs font-normal text-orange-400">
                （{conflicts.totalConflicts} 个）
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {/* 时间段重叠 */}
            {conflicts.timeOverlapConflicts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 font-medium">时间段重叠</p>
                {conflicts.timeOverlapConflicts.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs border rounded-md px-3 py-2 bg-orange-50/50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate text-slate-700">
                        {c.task1.title}
                      </span>
                      <span className="text-orange-400">×</span>
                      <span className="truncate text-slate-700">
                        {c.task2.title}
                      </span>
                    </div>
                    <span className="text-orange-600 font-mono flex-shrink-0 ml-2">
                      重叠 {c.overlapDays} 天
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* 工时超载天数 */}
            {conflicts.overloadedDays.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 font-medium">工时超载</p>
                {conflicts.overloadedDays.slice(0, 5).map((d) => (
                  <div
                    key={d.date}
                    className="flex items-center justify-between text-xs border rounded-md px-3 py-2 bg-red-50/50"
                  >
                    <span className="text-slate-700 font-mono">{d.date}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-red-600 font-mono font-medium">
                        {d.hours}h
                      </span>
                      <span className="text-slate-400">
                        ({d.tasks.join(', ')})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
