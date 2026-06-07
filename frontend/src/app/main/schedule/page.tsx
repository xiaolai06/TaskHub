'use client';

import { Suspense, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Loader2,
  RefreshCw,
  WandSparkles,
  Sparkles,
  Info,
} from 'lucide-react';
import { GanttChart } from '@/components/features/schedule/GanttChart';
import { InsertionDialog } from '@/components/features/schedule/InsertionDialog';
import { ScheduleStats } from '@/components/features/schedule/ScheduleStats';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useProjectList } from '@/hooks/useProjects';
import { useConflicts, useDelays, useRefreshSchedule, useSchedule } from '@/hooks/useSchedule';
import { toast } from 'sonner';

function formatDate(date: string | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

const toolBtnCls = 'h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground/80 hover:bg-accent transition-colors inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed';

function ScheduleContent() {
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get('projectId') || '';
  const [projectId, setProjectId] = useState(initialProjectId);
  const [dailyHourLimit, setDailyHourLimit] = useState(8);
  const [insertionOpen, setInsertionOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const { data: projectList, isLoading: projectsLoading } = useProjectList({ limit: 100, status: 'ACTIVE' });
  const projects = projectList?.data || [];
  const effectiveProjectId = projectId ?? (projects[0]?.id || '');
  const isAllProjects = projectId === '';
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === effectiveProjectId),
    [projects, effectiveProjectId],
  );

  const {
    data: schedule,
    isLoading: scheduleLoading,
    isFetching: scheduleFetching,
    error: scheduleError,
  } = useSchedule(effectiveProjectId, dailyHourLimit);
  const { data: delays = [] } = useDelays(effectiveProjectId);
  const { data: conflicts } = useConflicts(effectiveProjectId, dailyHourLimit);
  const refreshSchedule = useRefreshSchedule(effectiveProjectId);

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!schedule) return;
      await Promise.all(
        schedule.tasks.map((task) =>
          api.put(`/tasks/${task.id}`, {
            startDate: new Date(task.scheduledStart).toISOString(),
            dueDate: new Date(task.scheduledEnd).toISOString(),
          }),
        ),
      );
    },
    onSuccess: () => {
      refreshSchedule();
      toast.success('排期已写入任务日期');
    },
  });

  // 智能安排：发送到 AI 青板，包含项目描述作为排期依据
  const hasScheduleData = schedule && schedule.tasks.length > 0;
  const hasProjectDesc = selectedProject?.description;

  async function handleAiSchedule() {
    if (!effectiveProjectId) return;
    setAiLoading(true);
    try {
      const parts = [`请帮我分析项目「${selectedProject?.name || ''}」的排期：`];
      parts.push(`当前每日工时上限 ${dailyHourLimit}h，${schedule?.summary.totalTasks ?? 0} 个任务共 ${schedule?.summary.totalHours ?? 0}h，延期 ${schedule?.summary.delayedTasks ?? 0} 个，冲突 ${schedule?.summary.conflictDays ?? 0} 天。`);

      // 附上任务清单（含描述和工时）
      if (schedule?.tasks?.length) {
        parts.push('\n\n任务清单：');
        for (const t of schedule.tasks) {
          const desc = t.description ? ` — ${t.description.slice(0, 80)}` : '';
          parts.push(`\n- ${t.title}（${t.effectiveHours}h，${t.priority}，${t.scheduledStart}~${t.scheduledEnd}）${desc}`);
        }
      }

      if (hasProjectDesc) {
        parts.push(`\n项目说明：${selectedProject.description}`);
        parts.push('\n请结合项目说明，分析任务拆分是否合理、工时估算是否准确、有没有遗漏的任务。');
      }

      if (!hasScheduleData) {
        parts.push('\n当前没有已记录实际工时的任务，无法自动排期。请根据项目说明，帮我拆解任务并给出排期建议。');
      }

      parts.push('\n请给出具体的排期优化建议，包括哪些任务应该优先、是否需要调整工时上限、预计完成时间是否合理。');

      await api.post('/llm/chat', { message: parts.join('') });
      toast.success('AI 排期建议已生成');
    } catch {
      toast.error('AI 排期请求失败，请检查 AI 配置');
    } finally {
      setAiLoading(false);
    }
  }

  if (projectsLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-24">
        <Calendar className="mb-3 h-12 w-12 text-slate-200" />
        <p className="text-sm text-muted-foreground">暂无进行中的项目</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={effectiveProjectId}
          onChange={(event) => setProjectId(event.target.value)}
          className={toolBtnCls}
        >
          <option value="">全部项目</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>

        <label className={cn(toolBtnCls, 'cursor-default')}>
          每日
          <input type="number" min={1} max={24} value={dailyHourLimit}
            onChange={(event) => setDailyHourLimit(Number(event.target.value) || 8)}
            className="w-10 border-none bg-transparent text-center outline-none" />
          h
        </label>

        <button onClick={refreshSchedule} disabled={scheduleFetching} className={toolBtnCls}>
          {scheduleFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          重新计算
        </button>

        <button onClick={() => setInsertionOpen(true)} className={toolBtnCls}>
          <WandSparkles className="h-3.5 w-3.5" />插单模拟
        </button>

        <button onClick={handleAiSchedule} disabled={aiLoading || !effectiveProjectId || !hasScheduleData} className={cn(toolBtnCls, 'text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100', (!effectiveProjectId || !hasScheduleData) && 'opacity-50 cursor-not-allowed')} title={!hasScheduleData ? '暂无排期数据，请先在任务中填写实际工时' : ''}>
          {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          智能安排
        </button>

        <InsertionDialog projectId={effectiveProjectId} open={insertionOpen} onOpenChange={setInsertionOpen} />
      </div>

      {scheduleError ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4" />排期计算失败，请稍后重试
        </div>
      ) : scheduleLoading || !schedule ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      ) : (
        <>
          <ScheduleStats schedule={schedule} delays={delays} conflicts={conflicts} />

          <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
            {/* 左侧：甘特图 */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">{selectedProject?.name || '全部项目'}</h2>
                  <p className="text-[11px] text-muted-foreground">
                    计划周期 {formatDate(schedule.summary.projectStart)} ~ {formatDate(schedule.summary.projectEnd)}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  {schedule.tasks.length} 个任务
                </span>
              </div>
              <GanttChart tasks={schedule.tasks} dailyWorkload={schedule.dailyWorkload} />
            </div>

            {/* 右侧：摘要 + 操作 */}
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold text-foreground">排期摘要</h3>
                <div className="mt-3 space-y-2 text-xs">
                  <SummaryRow label="项目" value={selectedProject?.name || '-'} />
                  <SummaryRow label="总工时" value={`${schedule.summary.totalHours}h`} />
                  <SummaryRow label="延期任务" value={schedule.summary.delayedTasks} danger={schedule.summary.delayedTasks > 0} />
                  <SummaryRow label="冲突天数" value={schedule.summary.conflictDays} danger={schedule.summary.conflictDays > 0} />
                </div>
              </div>

              {/* 应用排期 */}
              <Button
                onClick={() => applyMutation.mutate()}
                disabled={!schedule.tasks.length || applyMutation.isPending}
                className="h-10 w-full gap-1.5"
              >
                {applyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                应用排期到任务日期
              </Button>

              {/* 调度建议 */}
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold text-foreground">调度建议</h3>
                <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                  <p>1. 先用当前每日工时上限试算，再根据延期与冲突结果调整负载。</p>
                  <p>2. 新需求先走插单模拟，避免直接打乱已有交付承诺。</p>
                  <p>3. 结果确认后再写回任务日期，确保项目页和任务页保持一致。</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryRow({ label, value, danger = false }: { label: string; value: ReactNode; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-medium text-foreground', danger && 'text-red-600')}>{value}</span>
    </div>
  );
}

export default function SchedulePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>}>
      <ScheduleContent />
    </Suspense>
  );
}
