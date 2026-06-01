'use client';

import { Clock, Power, PowerOff, Trash2, Edit3, Play, Tag, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CronJob } from '@/hooks/useCronJobs';

const ACTION_LABELS: Record<string, string> = {
  NOTIFY: '通知',
  AI_ANALYSIS: 'AI 分析',
  WEBHOOK: 'Webhook',
};

function parseConfig(cfg: string): Record<string, any> {
  try { return JSON.parse(cfg); } catch { return {}; }
}

export function CronJobCard({
  job,
  onToggle,
  onDelete,
  onEdit,
}: {
  job: CronJob;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const config = parseConfig(job.config);

  return (
    <div className={cn(
      'rounded-xl border bg-white p-4 transition-all hover:shadow-sm',
      job.enabled ? 'border-slate-200' : 'border-slate-100 opacity-60',
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800">{job.name}</h3>
            <span className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
              ACTION_LABELS[job.action] ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-500',
            )}>
              <Tag className="h-3 w-3" />
              {ACTION_LABELS[job.action] || job.action}
            </span>
            {job.isSystem && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                系统
              </span>
            )}
          </div>

          <div className="mt-1.5 flex items-center gap-3 text-[12px] text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {job.cronExpr}
            </span>
            {job.timezone && (
              <span className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {job.timezone}
              </span>
            )}
          </div>

          {config.description && (
            <p className="mt-1.5 text-[12px] text-slate-500">{config.description}</p>
          )}

          {job.lastRunAt && (
            <p className="mt-1 text-[11px] text-slate-400">
              上次执行: {new Date(job.lastRunAt).toLocaleString('zh-CN')}
              {job.lastStatus && (
                <span className={cn('ml-2', job.lastStatus === 'success' ? 'text-emerald-500' : 'text-red-500')}>
                  {job.lastStatus === 'success' ? '✅' : '❌'}
                </span>
              )}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onToggle}
            className={cn(
              'rounded-lg p-1.5 transition-colors',
              job.enabled ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-300 hover:bg-slate-50',
            )}
            title={job.enabled ? '禁用' : '启用'}
          >
            {job.enabled ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
          </button>
          {!job.isSystem && (
            <>
              <button onClick={onEdit} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-indigo-500" title="编辑">
                <Edit3 className="h-4 w-4" />
              </button>
              <button onClick={onDelete} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500" title="删除">
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
          <button className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-500" title="手动触发">
            <Play className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
