'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Loader2, Plus, RefreshCw, CheckCircle, XCircle, Circle,
  ChevronDown, Settings, BellRing, Clock, ArrowRight,
  ListChecks, History, Play, FlaskConical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CronJobForm } from '@/components/features/cron-job/CronJobForm';
import { SingleJob } from '@/components/features/ai/JobConfigPanel';
import { GlobalExecutionHistory } from '@/components/features/cron-job/GlobalExecutionHistory';
import {
  ACTION_BADGE, JOB_ICONS, describeCron, parseConfig,
  fetchWebhooks, fetchModels, type AIModel, type WH,
} from '@/components/features/cron-job/cron-utils';
import {
  useCronJobs, useCreateCronJob, useUpdateCronJob,
  useDeleteCronJob, useInitSystemJobs,
  useRunJob, useTestNotify, useRunCustomJob, useTestCustomJob,
  type CronJob,
} from '@/hooks/useCronJobs';

// ═══ 主页面 ═══

export default function AiWorkbenchPage() {
  const [mainTab, setMainTab] = useState<'rules' | 'history'>('rules');
  const [filterTab, setFilterTab] = useState<'all' | 'NOTIFY' | 'AI_ANALYSIS'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [models, setModels] = useState<AIModel[]>([]);
  const [webhooks, setWebhooks] = useState<WH[]>([]);

  const { data: jobs, isLoading, refetch } = useCronJobs();
  const createMut = useCreateCronJob();
  const updateMut = useUpdateCronJob();
  const deleteMut = useDeleteCronJob();
  const initMut = useInitSystemJobs();

  const filteredJobs = filterTab === 'all' ? (jobs || []) : (jobs || []).filter(j => j.action === filterTab);

  useEffect(() => {
    let off = false;
    fetchModels().then(m => { if (!off) setModels(m); });
    fetchWebhooks().then(w => { if (!off) setWebhooks(w); });
    return () => { off = true; };
  }, []);

  return (
    <div className="mx-auto max-w-3xl page-enter">
      {/* 顶部：主 Tab + 操作 */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
          {([
            { key: 'rules' as const, label: '定时设置', icon: ListChecks },
            { key: 'history' as const, label: '执行历史', icon: History },
          ]).map(tab => (
            <button key={tab.key} onClick={() => setMainTab(tab.key)}
              className={cn('flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-all',
                mainTab === tab.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-accent')}>
              <tab.icon className="h-3.5 w-3.5" />{tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => initMut.mutate(undefined, { onSuccess: () => refetch() })} disabled={initMut.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent disabled:opacity-50">
            <RefreshCw className={cn('h-3.5 w-3.5', initMut.isPending && 'animate-spin')} />重置
          </button>
          <button onClick={() => { setEditingJob(null); setFormOpen(true); }}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 active:scale-95">
            <Plus className="h-3.5 w-3.5" />新建定时
          </button>
        </div>
      </div>

      {isLoading && <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-indigo-400" /></div>}

      {!isLoading && jobs && jobs.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16">
          <BellRing className="h-10 w-10 text-rose-200" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">还没有任何定时任务</p>
          <p className="mt-1 text-xs text-muted-foreground/60">初始化系统任务，或创建自定义定时</p>
          <div className="mt-4 flex gap-2">
            <button onClick={() => initMut.mutate(undefined, { onSuccess: () => refetch() })} disabled={initMut.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-100 disabled:opacity-50">初始化系统任务</button>
            <button onClick={() => { setEditingJob(null); setFormOpen(true); }}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">新建定时</button>
          </div>
        </div>
      )}

      {!isLoading && jobs && jobs.length > 0 && (
        <div className="space-y-4">
          {mainTab === 'rules' && (
            <>
              {/* 筛选 Tab */}
              <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-1 py-1">
                {([
                  { key: 'all' as const, label: '全部' },
                  { key: 'NOTIFY' as const, label: '通知' },
                  { key: 'AI_ANALYSIS' as const, label: '报表' },
                ]).map(tab => (
                  <button key={tab.key} onClick={() => setFilterTab(tab.key)}
                    className={cn('rounded-md px-3 py-1 text-xs font-medium transition-all',
                      filterTab === tab.key
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-muted-foreground hover:bg-accent')}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* 任务列表 */}
              <div className="space-y-2">
                {filteredJobs.map(job => (
                  <JobCard key={job.id} job={job} models={models} webhooks={webhooks}
                    onToggle={() => updateMut.mutate({ id: job.id, data: { enabled: !job.enabled } })}
                    onEdit={() => { setEditingJob(job); setFormOpen(true); }}
                    onDelete={() => { if (confirm('确定删除？')) deleteMut.mutate(job.id, { onSuccess: () => refetch() }); }}
                  />
                ))}
                {filteredJobs.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground/50">该类型暂无任务</p>
                )}
              </div>
            </>
          )}

          {mainTab === 'history' && <GlobalExecutionHistory />}
        </div>
      )}

      <CronJobForm open={formOpen} onClose={() => { setFormOpen(false); setEditingJob(null); }}
        webhooks={webhooks} models={models}
        onSave={async (data) => {
          if (editingJob) await updateMut.mutateAsync({ id: editingJob.id, data });
          else await createMut.mutateAsync(data);
          setFormOpen(false); setEditingJob(null);
        }}
        initial={editingJob ? { name: editingJob.name, cronExpr: editingJob.cronExpr, action: editingJob.action, timezone: editingJob.timezone, config: editingJob.config, aiModel: editingJob.aiModel ?? undefined } : undefined} />
    </div>
  );
}

// ═══ 统一任务卡片 ═══

function JobCard({ job, models, webhooks, onToggle, onEdit, onDelete }: {
  job: CronJob; models: AIModel[]; webhooks: WH[];
  onToggle: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const icon = JOB_ICONS[job.name] || (job.isSystem ? '⚡' : '🔔');
  const badge = ACTION_BADGE[job.action] || { label: job.action, cls: 'bg-muted text-muted-foreground' };
  const cronDesc = describeCron(job.cronExpr);
  const cfg = parseConfig(job.config);
  const hasContent = job.action === 'NOTIFY' ? !!cfg.message : true;

  const runSysMut = useRunJob();
  const testSysMut = useTestNotify();
  const runCustMut = useRunCustomJob();
  const testCustMut = useTestCustomJob();

  // 自动清除反馈
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  const handleRun = async () => {
    setFeedback(null);
    try {
      if (job.isSystem) {
        const r = await runSysMut.mutateAsync(job.jobSlug || job.name);
        setFeedback({ type: 'success', msg: `✅ ${r.label || job.name} 执行完成` });
      } else {
        const r = await runCustMut.mutateAsync(job.id);
        setFeedback({ type: 'success', msg: `✅ ${r.result}` });
      }
    } catch (e) {
      setFeedback({ type: 'error', msg: `❌ ${e instanceof Error ? e.message : '执行失败'}` });
    }
  };

  const handleTest = async () => {
    setFeedback(null);
    try {
      if (job.isSystem) {
        const r = await testSysMut.mutateAsync(job.id);
        const summary = r.results.map(ch => `${ch.channel}: ${ch.ok ? '✓' : '✗'}`).join(' | ');
        setFeedback({ type: r.allOk ? 'success' : 'error', msg: r.allOk ? `✅ 测试发送成功: ${summary}` : `⚠️ 部分失败: ${summary}` });
      } else {
        const r = await testCustMut.mutateAsync(job.id);
        setFeedback({ type: 'success', msg: `✅ 测试已发送到 ${r.channels.length} 个渠道` });
      }
    } catch (e) {
      setFeedback({ type: 'error', msg: `❌ ${e instanceof Error ? e.message : '测试失败'}` });
    }
  };

  return (
    <div className={cn('rounded-xl border bg-card transition-all', job.enabled ? 'border-border' : 'opacity-50')}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={onToggle} className={cn('shrink-0', job.enabled ? 'text-emerald-500' : 'text-muted-foreground/40')}>
          {job.enabled ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
        </button>
        <span className="text-base">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{job.name}</span>
            <span className={cn('rounded-full px-1.5 py-0.5 text-2xs font-medium', badge.cls)}>{badge.label}</span>
            {job.isSystem && <span className="rounded-full bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground/60">系统</span>}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-2xs text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            <span>{cronDesc || job.cronExpr}</span>
            {job.action === 'NOTIFY' && typeof cfg.message === 'string' && cfg.message && (
              <span className="text-muted-foreground/40 truncate max-w-[200px]">· {cfg.message}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={handleTest} disabled={testSysMut.isPending || testCustMut.isPending}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-2xs-plus text-muted-foreground hover:bg-amber-50 hover:text-amber-600 disabled:opacity-40"
            title="发送测试通知">
            <FlaskConical className="h-3 w-3" />测试
          </button>
          <button onClick={handleRun} disabled={runSysMut.isPending || runCustMut.isPending || (!job.isSystem && !hasContent)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-2xs-plus text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-40"
            title="立即执行">
            <Play className="h-3 w-3" />执行
          </button>
          {!job.isSystem && (
            <>
              <button onClick={onEdit} className="rounded-md px-2 py-1 text-2xs-plus text-muted-foreground hover:bg-indigo-50 hover:text-indigo-500">编辑</button>
              <button onClick={onDelete} className="rounded-md px-2 py-1 text-2xs-plus text-muted-foreground hover:bg-red-50 hover:text-red-500">删除</button>
            </>
          )}
          <button onClick={() => setOpen(!open)} className="flex items-center gap-0.5 rounded-md p-1.5 text-muted-foreground hover:bg-accent">
            <Settings className="h-4 w-4" />
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* 反馈条 */}
      {feedback && (
        <div className={cn('border-t px-4 py-2 text-xs',
          feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50/50 text-emerald-700' : 'border-red-200 bg-red-50/50 text-red-600')}>
          {feedback.msg}
        </div>
      )}

      {/* 展开配置 */}
      {open && (
        <div className="border-t border-border/60 px-5 py-4">
          <SingleJob job={job} models={models} webhooks={webhooks} onToggle={onToggle} />
        </div>
      )}
    </div>
  );
}
