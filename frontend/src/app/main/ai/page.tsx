'use client';

import { useState } from 'react';
import { Loader2, Clock, Plus, RefreshCw, CheckCircle, XCircle, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CronJobForm } from '@/components/features/cron-job/CronJobForm';
import {
  useCronJobs, useCreateCronJob, useUpdateCronJob,
  useDeleteCronJob, useInitSystemJobs,
  type CronJob,
} from '@/hooks/useCronJobs';

const ACTION_BADGE: Record<string, { label: string; cls: string }> = {
  NOTIFY: { label: '通知', cls: 'bg-blue-50 text-blue-600' },
  AI_ANALYSIS: { label: 'AI分析', cls: 'bg-purple-50 text-purple-600' },
  WEBHOOK: { label: 'Webhook', cls: 'bg-amber-50 text-amber-600' },
};

const CRON_LABELS: Record<string, string> = {
  '0 8 * * *': '每天 8:00',
  '0 9 * * *': '每天 9:00',
  '0 10 * * *': '每天 10:00',
  '0 9 * * 1': '每周一 9:00',
  '0 20 * * 0': '每周日 20:00',
  '0 10 * * 0': '每周日 10:00',
  '* * * * *': '每分钟',
};

export default function AiWorkbenchPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);

  const { data: jobs, isLoading, refetch } = useCronJobs();
  const createMutation = useCreateCronJob();
  const updateMutation = useUpdateCronJob();
  const deleteMutation = useDeleteCronJob();
  const initMutation = useInitSystemJobs();

  const systemJobs = jobs?.filter(j => j.isSystem) || [];
  const customJobs = jobs?.filter(j => !j.isSystem) || [];

  return (
    <div className="mx-auto max-w-3xl">
      {/* 头部 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">定时任务</h1>
          <p className="mt-0.5 text-xs text-slate-400">
            配置定时自动执行的任务，系统预置任务首次启动时自动初始化
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => initMutation.mutate(undefined, { onSuccess: () => refetch() })}
            disabled={initMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', initMutation.isPending && 'animate-spin')} />
            重置
          </button>
          <button
            onClick={() => { setEditingJob(null); setFormOpen(true); }}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-indigo-700 active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            自定义任务
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-indigo-400" /></div>
      )}

      {/* Empty */}
      {!isLoading && jobs && jobs.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-12">
          <Clock className="h-10 w-10 text-slate-200" />
          <p className="mt-3 text-sm font-medium text-slate-500">暂无定时任务</p>
          <p className="mt-1 text-xs text-slate-400">系统任务首次启动自动初始化，或点击下方手动创建</p>
          <div className="mt-4 flex gap-2">
            <button onClick={() => initMutation.mutate(undefined, { onSuccess: () => refetch() })} disabled={initMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-100 disabled:opacity-50">
              初始化系统任务
            </button>
            <button onClick={() => { setEditingJob(null); setFormOpen(true); }}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700">
              自定义任务
            </button>
          </div>
        </div>
      )}

      {/* 列表 */}
      {!isLoading && jobs && jobs.length > 0 && (
        <div className="space-y-6">
          {/* 系统预置 */}
          {systemJobs.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <Circle className="h-2 w-2 fill-indigo-400 text-indigo-400" />
                系统预置（{systemJobs.length}）
              </h2>
              <div className="space-y-1.5">
                {systemJobs.map(job => (
                  <JobRow key={job.id} job={job}
                    onToggle={() => updateMutation.mutate({ id: job.id, data: { enabled: !job.enabled } })} />
                ))}
              </div>
            </section>
          )}

          {/* 自定义 */}
          {customJobs.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <Circle className="h-2 w-2 fill-amber-400 text-amber-400" />
                自定义（{customJobs.length}）
              </h2>
              <div className="space-y-1.5">
                {customJobs.map(job => (
                  <JobRow key={job.id} job={job}
                    onToggle={() => updateMutation.mutate({ id: job.id, data: { enabled: !job.enabled } })}
                    onEdit={() => { setEditingJob(job); setFormOpen(true); }}
                    onDelete={() => { if (confirm('删除这个任务？')) deleteMutation.mutate(job.id, { onSuccess: () => refetch() }); }} />
                ))}
              </div>
            </section>
          )}

          {/* 弹窗 */}
          <CronJobForm
            open={formOpen}
            onClose={() => { setFormOpen(false); setEditingJob(null); }}
            onSave={async (data) => {
              if (editingJob) {
                await updateMutation.mutateAsync({ id: editingJob.id, data });
              } else {
                await createMutation.mutateAsync(data);
              }
              setFormOpen(false); setEditingJob(null);
            }}
            initial={editingJob ? {
              name: editingJob.name, cronExpr: editingJob.cronExpr,
              action: editingJob.action, timezone: editingJob.timezone, config: editingJob.config,
            } : undefined}
          />
        </div>
      )}
    </div>
  );
}

// ═══ 单行任务 ═══

function JobRow({ job, onToggle, onEdit, onDelete }: {
  job: CronJob;
  onToggle: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const badge = ACTION_BADGE[job.action] || { label: job.action, cls: 'bg-slate-50 text-slate-500' };

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-lg border bg-white px-3.5 py-3 transition-colors',
      job.enabled ? 'border-slate-200' : 'border-slate-100 opacity-45',
    )}>
      {/* 启用开关 */}
      <button onClick={onToggle}
        className={cn('shrink-0 rounded-md p-1 transition-colors', job.enabled ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-300 hover:bg-slate-50')}
        title={job.enabled ? '已启用，点击禁用' : '已禁用，点击启用'}>
        {job.enabled ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
      </button>

      {/* 信息 */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">{job.name}</span>
          <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', badge.cls)}>{badge.label}</span>
          {job.isSystem && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">系统</span>}
        </div>
        <p className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
          <Clock className="h-3 w-3 shrink-0" />
          <code className="font-mono text-[11px]">{job.cronExpr}</code>
          <span className="text-slate-300">—</span>
          <span>{CRON_LABELS[job.cronExpr] || job.cronExpr}</span>
        </p>
      </div>

      {/* 操作（仅自定义任务） */}
      {!job.isSystem && (
        <div className="flex items-center gap-1">
          {onEdit && (
            <button onClick={onEdit}
              className="rounded-md px-2 py-1 text-[11px] text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-500">
              编辑
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete}
              className="rounded-md px-2 py-1 text-[11px] text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500">
              删除
            </button>
          )}
        </div>
      )}
    </div>
  );
}
