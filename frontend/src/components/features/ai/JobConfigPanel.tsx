'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, ChevronDown, Play,
  CheckCircle, XCircle, Cpu, Save,
  Mail, Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { ExecutionHistory } from '@/components/features/cron-job/ExecutionHistory';
import { Toggle, NRow } from '@/components/features/cron-job/shared-ui';
import {
  CRON_PRESETS, JOB_ICONS, CH_ICONS,
  describeCron, parseConfig, fetchWebhooks, fetchModels, type AIModel, type WH,
} from '@/components/features/cron-job/cron-utils';
import {
  useCronJobs, useUpdateCronJob, useRunJob, useTestNotify,
  type CronJob,
} from '@/hooks/useCronJobs';

// ═══ 单任务配置面板（供 page.tsx 展开调用） ═══

function SingleJobInner({ job, models, webhooks, onToggle }: {
  job: CronJob; models: AIModel[]; webhooks: WH[]; onToggle: () => void;
}) {
  const [cron, setCron] = useState(job.cronExpr);
  const [model, setModel] = useState(job.aiModel || '');
  const [emailOn, setEmailOn] = useState(false);
  const [targets, setTargets] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [runRes, setRunRes] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testRes, setTestRes] = useState<Array<{ channel: string; ok: boolean; msg: string }> | null>(null);

  const uMut = useUpdateCronJob();
  const rMut = useRunJob();
  const tMut = useTestNotify();

  const cfg = parseConfig(job.config);
  const cronDesc = describeCron(cron);

  useEffect(() => {
    setCron(job.cronExpr);
    setModel(job.aiModel || '');
    const c = parseConfig(job.config);
    setEmailOn(!!c.emailEnabled);
    setTargets(Array.isArray(c.webhookTargets) ? c.webhookTargets : []);
    setSaved(false);
    setTestRes(null);
  }, [job.cronExpr, job.aiModel, job.config]);

  useEffect(() => {
    if (!testRes) return;
    const t = setTimeout(() => setTestRes(null), 5000);
    return () => clearTimeout(t);
  }, [testRes]);

  useEffect(() => {
    if (!runRes) return;
    const t = setTimeout(() => setRunRes(null), 5000);
    return () => clearTimeout(t);
  }, [runRes]);

  const dirty = cron !== job.cronExpr || model !== (job.aiModel || '')
    || emailOn !== !!cfg.emailEnabled || JSON.stringify(targets) !== JSON.stringify(cfg.webhookTargets || []);

  const toggleWH = (n: string) => setTargets(p => p.includes(n) ? p.filter(x => x !== n) : [...p, n]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const nc = { ...cfg, emailEnabled: emailOn, webhookTargets: targets };
      await uMut.mutateAsync({ id: job.id, data: { cronExpr: cron, aiModel: model || undefined, config: JSON.stringify(nc) } });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  }, [job.id, cron, model, emailOn, targets, cfg, uMut]);

  const handleRun = useCallback(async () => {
    setRunRes(null);
    try {
      const slug = job.jobSlug || job.name;
      const r = await rMut.mutateAsync(slug);
      setRunRes({ ok: true, msg: `✅ ${r.label || job.name} 完成` });
    }
    catch (e) { setRunRes({ ok: false, msg: `❌ ${e instanceof Error ? e.message : '失败'}` }); }
  }, [job.name, job.jobSlug, rMut]);

  const handleTest = useCallback(async () => {
    setTestRes(null);
    try {
      const r = await tMut.mutateAsync(job.id);
      setTestRes(r.results);
    } catch (e) {
      setTestRes([{ channel: '错误', ok: false, msg: e instanceof Error ? e.message : '测试失败' }]);
    }
  }, [job.id, tMut]);

  return (
    <div className="space-y-4">
      {/* 频率 */}
      <div>
        <p className="mb-1.5 text-2xs-plus font-semibold uppercase tracking-wider text-muted-foreground">执行频率</p>
        <input value={cron} onChange={e => setCron(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60" />
        {cronDesc && (
          <p className="mt-1 flex items-center gap-1.5 text-2xs text-indigo-500">
            <span>→</span>{cronDesc}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {CRON_PRESETS.map(p => (
            <button key={p.expr} type="button" onClick={() => setCron(p.expr)}
              className={cn('rounded-md border px-2 py-1 text-2xs-plus transition-colors',
                cron === p.expr ? 'border-indigo-300 bg-indigo-50 text-indigo-600' : 'border-border text-muted-foreground hover:border-indigo-200')}>
              {p.label}
            </button>
          ))}
        </div>
        {job.isSystem && dirty && (
          <p className="mt-1.5 text-2xs text-amber-500">⚠ 修改系统任务频率后，需重启服务才能生效</p>
        )}
      </div>

      {/* 通知渠道 */}
      <div>
        <p className="mb-1.5 text-2xs-plus font-semibold uppercase tracking-wider text-muted-foreground">通知渠道</p>
        <div className="rounded-lg border border-border bg-background divide-y divide-border/50">
          <NRow icon="📧" label="邮件通知"><Toggle on={emailOn} onChange={setEmailOn} /></NRow>
          {webhooks.length > 0 ? webhooks.map(wh => (
            <NRow key={wh.name} icon={CH_ICONS[wh.channel] || '🔗'} label={wh.name} sub={wh.channel}>
              <input type="checkbox" checked={targets.includes(wh.name)} onChange={() => toggleWH(wh.name)}
                className="h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500" />
            </NRow>
          )) : (
            <div className="px-3 py-2 text-2xs-plus text-muted-foreground/50">暂无推送目标，去系统设置添加</div>
          )}
        </div>
      </div>

      {/* AI 模型 */}
      {job.action === 'AI_ANALYSIS' && (
        <div>
          <p className="mb-1.5 text-2xs-plus font-semibold uppercase tracking-wider text-muted-foreground">AI 模型</p>
          <Select value={model} onValueChange={(v) => setModel(v || "")}>
            <SelectTrigger className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60">
              <SelectValue placeholder="使用默认模型" />
            </SelectTrigger>
            <SelectContent>
              {models.map(m => <SelectItem key={m.id} value={m.id}>{m.name} ({m.providerLabel})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center gap-2 pt-1">
        <button onClick={handleRun} disabled={rMut.isPending}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground/60 hover:bg-accent disabled:opacity-50">
          {rMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}执行
        </button>
        <button onClick={handleTest} disabled={tMut.isPending}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground/60 hover:bg-accent disabled:opacity-40">
          {tMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}测试通知
        </button>
        <div className="flex-1" />
        <button onClick={handleSave} disabled={saving || !dirty}
          className={cn('flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-medium transition-all disabled:opacity-40',
            dirty ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-muted text-muted-foreground')}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saved ? '已保存 ✓' : '保存配置'}
        </button>
      </div>

      {/* 结果反馈 */}
      {runRes && <p className={cn('text-sm', runRes.ok ? 'text-emerald-500' : 'text-red-500')}>{runRes.msg}</p>}
      {testRes && testRes.length > 0 && (
        <div className="rounded-lg border border-border divide-y divide-border/50">
          {testRes.map((r, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 text-xs">
              {r.ok ? <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />}
              <span className="font-medium text-foreground/60">{r.channel}</span>
              <span className={r.ok ? 'text-emerald-600' : 'text-red-500'}>{r.msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* 最近执行 */}
      {job.lastRunAt && (
        <p className="text-2xs-plus text-muted-foreground">
          上次执行: {new Date(job.lastRunAt).toLocaleString('zh-CN')}
          {job.lastStatus && (job.lastStatus === 'success' ? ' ✅' : ' ❌')}
        </p>
      )}

      {/* 执行历史 */}
      <ExecutionHistory jobId={job.id} />
    </div>
  );
}

// ═══ 导出：单任务面板（供 page.tsx 展开调用） ═══

export function SingleJob(props: { job: CronJob; models: AIModel[]; webhooks: WH[]; onToggle: () => void }) {
  return <SingleJobInner {...props} />;
}

// ═══ 导出：完整面板（独立使用，含数据获取） ═══

function JobCard({ job, models, webhooks, onToggle }: {
  job: CronJob; models: AIModel[]; webhooks: WH[]; onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  const icon = JOB_ICONS[job.name] || '⚡';

  return (
    <div className={cn('rounded-lg border bg-card', job.enabled ? 'border-border' : 'opacity-50')}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left">
        <span className={cn('shrink-0', job.enabled ? 'text-emerald-500' : 'text-muted-foreground/40')}
          onClick={e => { e.stopPropagation(); onToggle(); }}>
          {job.enabled ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        </span>
        <span className="text-sm">{icon}</span>
        <span className="min-w-0 flex-1 text-xs font-semibold text-foreground truncate">{job.name}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-border/60 px-3 pb-3 pt-2">
          <SingleJobInner job={job} models={models} webhooks={webhooks} onToggle={onToggle} />
        </div>
      )}
    </div>
  );
}

export function JobConfigPanel() {
  const { data: jobs, isLoading } = useCronJobs();
  const updateMut = useUpdateCronJob();
  const [models, setModels] = useState<AIModel[]>([]);
  const [webhooks, setWebhooks] = useState<WH[]>([]);

  useEffect(() => {
    let off = false;
    fetchModels().then(m => { if (!off) setModels(m); });
    fetchWebhooks().then(w => { if (!off) setWebhooks(w); });
    return () => { off = true; };
  }, []);

  const sj = jobs?.filter(j => j.isSystem) || [];
  if (isLoading) return <div className="flex items-center gap-2 py-2"><Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /><span className="text-2xs-plus text-muted-foreground">加载中...</span></div>;
  if (sj.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {sj.map(job => (
        <JobCard key={job.id} job={job} models={models} webhooks={webhooks}
          onToggle={() => updateMut.mutate({ id: job.id, data: { enabled: !job.enabled } })} />
      ))}
    </div>
  );
}

