'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Clock, Plus, RefreshCw, CheckCircle, XCircle, Circle,
  ChevronDown, Settings, Play, Cpu, Save, Mail, Bell, Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { CronJobForm } from '@/components/features/cron-job/CronJobForm';
import {
  useCronJobs, useCreateCronJob, useUpdateCronJob,
  useDeleteCronJob, useInitSystemJobs, useRunJob, useTestNotify,
  type CronJob,
} from '@/hooks/useCronJobs';

// ═══ 常量 ═══

const ACTION_BADGE: Record<string, { label: string; cls: string }> = {
  NOTIFY: { label: '通知', cls: 'bg-blue-50 text-blue-600' },
  AI_ANALYSIS: { label: 'AI分析', cls: 'bg-purple-50 text-purple-600' },
  WEBHOOK: { label: 'Webhook', cls: 'bg-amber-50 text-amber-600' },
};

const CRON_LABELS: Record<string, string> = {
  '30 7 * * *': '每天 07:30', '0 8 * * *': '每天 08:00', '30 8 * * *': '每天 08:30',
  '0 9 * * *': '每天 09:00', '30 9 * * *': '每天 09:30', '0 10 * * *': '每天 10:00',
  '0 9 * * 1': '每周一 09:00', '0 10 * * 0': '每周日 10:00', '0 20 * * 0': '每周日 20:00',
  '* * * * *': '每分钟',
};

const CRON_PRESETS = [
  { label: '每天 7:30', expr: '30 7 * * *' },
  { label: '每天 8:00', expr: '0 8 * * *' },
  { label: '每天 8:30', expr: '30 8 * * *' },
  { label: '每天 9:00', expr: '0 9 * * *' },
  { label: '每天 9:30', expr: '30 9 * * *' },
  { label: '每天 10:00', expr: '0 10 * * *' },
  { label: '每周一 9:00', expr: '0 9 * * 1' },
  { label: '每周日 10:00', expr: '0 10 * * 0' },
  { label: '每周日 20:00', expr: '0 20 * * 0' },
];

const JOB_ICONS: Record<string, string> = {
  '成本预警': '💸', '晨间简报': '🌅',
  '客户雷达': '📡', '订单利润简报': '💰', '自动周报': '📊',
  '记忆沉淀': '🧠', '业务体检': '🫀',
};

const CH_ICONS: Record<string, string> = {
  wechat: '💬', feishu: '🐦', dingtalk: '📌', slack: '🔔',
};

interface AIModel { id: string; name: string; providerLabel: string; }
interface WH { name: string; channel: string; }

function parseConfig(cfg: string): Record<string, unknown> {
  try { return JSON.parse(cfg); } catch { return {}; }
}

// ═══ 数据获取 ═══

async function fetchWebhooks(): Promise<WH[]> {
  try {
    const settings = await api.get<Record<string, string>>('/settings/NOTIFY');
    if (settings?.webhooks) {
      const parsed = JSON.parse(settings.webhooks);
      if (Array.isArray(parsed)) return parsed.map((w: WH) => ({ name: w.name, channel: w.channel }));
    }
  } catch {}
  return [];
}

async function fetchModels(): Promise<AIModel[]> {
  try {
    const list = await api.get<Array<{ provider: string; label: string; models: Array<{ id: string; name: string }> }>>('/settings/ai/all-models');
    const out: AIModel[] = [];
    for (const g of list) for (const m of g.models) out.push({ id: m.id, name: m.name, providerLabel: g.label });
    return out;
  } catch { return []; }
}

// ═══ UI 小组件 ═══

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      className={cn('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors', on ? 'bg-indigo-600' : 'bg-accent')}>
      <span className={cn('h-4 w-4 rounded-full bg-card shadow transition-transform', on ? 'translate-x-4' : 'translate-x-0.5')} />
    </button>
  );
}

function NRow({ icon, label, sub, children }: { icon: React.ReactNode; label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm shrink-0">{icon}</span>
        <span className="text-[13px] text-foreground/80">{label}</span>
        {sub && <span className="text-[11px] text-muted-foreground/50">{sub}</span>}
      </div>
      {children}
    </div>
  );
}

// ═══ 主页面 ═══

export default function AiWorkbenchPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [models, setModels] = useState<AIModel[]>([]);
  const [webhooks, setWebhooks] = useState<WH[]>([]);

  const { data: jobs, isLoading, refetch } = useCronJobs();
  const createMut = useCreateCronJob();
  const updateMut = useUpdateCronJob();
  const deleteMut = useDeleteCronJob();
  const initMut = useInitSystemJobs();

  const sj = jobs?.filter(j => j.isSystem) || [];
  const cj = jobs?.filter(j => !j.isSystem) || [];

  useEffect(() => {
    let off = false;
    fetchModels().then(m => { if (!off) setModels(m); });
    fetchWebhooks().then(w => { if (!off) setWebhooks(w); });
    return () => { off = true; };
  }, []);

  return (
    <div className="mx-auto max-w-3xl page-enter">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">定时任务</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">管理执行频率、通知渠道和 AI 模型</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => initMut.mutate(undefined, { onSuccess: () => refetch() })} disabled={initMut.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent disabled:opacity-50">
            <RefreshCw className={cn('h-3.5 w-3.5', initMut.isPending && 'animate-spin')} />重置
          </button>
          <button onClick={() => { setEditingJob(null); setFormOpen(true); }}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 active:scale-95">
            <Plus className="h-3.5 w-3.5" />自定义任务
          </button>
        </div>
      </div>

      {isLoading && <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-indigo-400" /></div>}

      {!isLoading && jobs && jobs.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-12">
          <Clock className="h-10 w-10 text-slate-200" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">暂无定时任务</p>
          <div className="mt-4 flex gap-2">
            <button onClick={() => initMut.mutate(undefined, { onSuccess: () => refetch() })} disabled={initMut.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100 disabled:opacity-50">初始化系统任务</button>
            <button onClick={() => { setEditingJob(null); setFormOpen(true); }}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">自定义任务</button>
          </div>
        </div>
      )}

      {!isLoading && jobs && jobs.length > 0 && (
        <div className="space-y-6">
          {sj.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Circle className="h-2 w-2 fill-indigo-400 text-indigo-400" />系统预置（{sj.length}）
              </h2>
              <div className="space-y-2">
                {sj.map(job => (
                  <JobRow key={job.id} job={job} models={models} webhooks={webhooks}
                    onToggle={() => updateMut.mutate({ id: job.id, data: { enabled: !job.enabled } })} />
                ))}
              </div>
            </section>
          )}
          {cj.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Circle className="h-2 w-2 fill-amber-400 text-amber-400" />自定义（{cj.length}）
              </h2>
              <div className="space-y-2">
                {cj.map(job => (
                  <JobRow key={job.id} job={job} models={models} webhooks={webhooks}
                    onToggle={() => updateMut.mutate({ id: job.id, data: { enabled: !job.enabled } })}
                    onEdit={() => { setEditingJob(job); setFormOpen(true); }}
                    onDelete={() => { if (confirm('删除？')) deleteMut.mutate(job.id, { onSuccess: () => refetch() }); }} />
                ))}
              </div>
            </section>
          )}
          <CronJobForm open={formOpen} onClose={() => { setFormOpen(false); setEditingJob(null); }}
            onSave={async (data) => {
              if (editingJob) await updateMut.mutateAsync({ id: editingJob.id, data });
              else await createMut.mutateAsync(data);
              setFormOpen(false); setEditingJob(null);
            }}
            initial={editingJob ? { name: editingJob.name, cronExpr: editingJob.cronExpr, action: editingJob.action, timezone: editingJob.timezone, config: editingJob.config } : undefined} />
        </div>
      )}
    </div>
  );
}

// ═══ 任务卡片 ═══

function JobRow({ job, models, webhooks, onToggle, onEdit, onDelete }: {
  job: CronJob; models: AIModel[]; webhooks: WH[];
  onToggle: () => void; onEdit?: () => void; onDelete?: () => void;
}) {
  const [open, setOpen] = useState(false);
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

  const badge = ACTION_BADGE[job.action] || { label: job.action, cls: 'bg-muted text-muted-foreground' };
  const icon = JOB_ICONS[job.name] || '⚡';
  const cfg = parseConfig(job.config);
  const desc = (cfg.description as string) || '';

  useEffect(() => {
    setCron(job.cronExpr);
    setModel(job.aiModel || '');
    const c = parseConfig(job.config);
    setEmailOn(!!c.emailEnabled);
    setTargets(Array.isArray(c.webhookTargets) ? c.webhookTargets : []);
    setSaved(false);
    setTestRes(null);
  }, [job.cronExpr, job.aiModel, job.config]);

  // 测试结果 5 秒后自动消失
  useEffect(() => {
    if (!testRes) return;
    const t = setTimeout(() => setTestRes(null), 5000);
    return () => clearTimeout(t);
  }, [testRes]);

  // 执行结果 5 秒后自动消失
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
    try { const r = await rMut.mutateAsync(job.name); setRunRes({ ok: true, msg: `✅ ${r.label || job.name} 完成` }); }
    catch (e) { setRunRes({ ok: false, msg: `❌ ${e instanceof Error ? e.message : '失败'}` }); }
  }, [job.name, rMut]);

  const handleTest = useCallback(async () => {
    setTestRes(null);
    try {
      const r = await tMut.mutateAsync(job.id);
      setTestRes(r.results);
    } catch (e) {
      setTestRes([{ channel: '错误', ok: false, msg: e instanceof Error ? e.message : '测试失败' }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);

  return (
    <div className={cn('rounded-xl border bg-card transition-all', job.enabled ? 'border-border' : 'opacity-50')}>
      {/* 标题行 */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={onToggle} className={cn('shrink-0', job.enabled ? 'text-emerald-500' : 'text-muted-foreground/40')}>
          {job.enabled ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
        </button>
        <span className="text-sm">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{job.name}</span>
            <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', badge.cls)}>{badge.label}</span>
            {job.isSystem && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">系统</span>}
            {job.aiModel && <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600"><Cpu className="mr-0.5 inline h-2.5 w-2.5" />{job.aiModel}</span>}
          </div>
          <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            <code className="font-mono">{job.cronExpr}</code>
            <span className="text-muted-foreground/50">—</span>
            <span>{CRON_LABELS[job.cronExpr] || job.cronExpr}</span>
            {emailOn && <Mail className="ml-1 h-3 w-3 text-emerald-500" />}
            {targets.length > 0 && <Bell className="h-3 w-3 text-blue-500" />}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!job.isSystem && onEdit && <button onClick={onEdit} className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-indigo-50 hover:text-indigo-500">编辑</button>}
          {!job.isSystem && onDelete && <button onClick={onDelete} className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-red-50 hover:text-red-500">删除</button>}
          <button onClick={() => setOpen(!open)} className="flex items-center gap-0.5 rounded-md p-1.5 text-muted-foreground hover:bg-accent">
            <Settings className="h-4 w-4" />
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* 展开面板 — 单列 */}
      {open && (
        <div className="border-t border-border/60 px-5 py-4 space-y-4">
          {desc && <p className="rounded-lg bg-muted/40 px-3 py-2 text-[12px] text-muted-foreground">{desc}</p>}

          {/* 频率 */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">执行频率</p>
            <input value={cron} onChange={e => setCron(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CRON_PRESETS.map(p => (
                <button key={p.expr} type="button" onClick={() => setCron(p.expr)}
                  className={cn('rounded-md border px-2 py-1 text-[11px] transition-colors',
                    cron === p.expr ? 'border-indigo-300 bg-indigo-50 text-indigo-600' : 'border-border text-muted-foreground hover:border-indigo-200')}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* 通知渠道 */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">通知渠道</p>
            <div className="rounded-lg border border-border bg-background divide-y divide-border/50">
              <NRow icon="📧" label="邮件通知"><Toggle on={emailOn} onChange={setEmailOn} /></NRow>
              {webhooks.length > 0 ? webhooks.map(wh => (
                <NRow key={wh.name} icon={CH_ICONS[wh.channel] || '🔗'} label={wh.name} sub={wh.channel}>
                  <input type="checkbox" checked={targets.includes(wh.name)} onChange={() => toggleWH(wh.name)}
                    className="h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500" />
                </NRow>
              )) : (
                <div className="px-3 py-2 text-[11px] text-muted-foreground/50">暂无推送目标，去系统设置添加</div>
              )}
            </div>
          </div>

          {/* AI 模型 */}
          {job.action === 'AI_ANALYSIS' && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">AI 模型</p>
              <select value={model} onChange={e => setModel(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200">
                <option value="">使用默认模型</option>
                {models.map(m => <option key={m.id} value={m.id}>{m.name} ({m.providerLabel})</option>)}
              </select>
            </div>
          )}

          {/* 操作按钮 — 一行排列 */}
          <div className="flex items-center gap-2 pt-1">
            <button onClick={handleRun} disabled={rMut.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground/60 hover:bg-accent disabled:opacity-50">
              {rMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}执行任务
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

          {/* 结果 */}
          {runRes && <p className={cn('text-sm', runRes.ok ? 'text-emerald-500' : 'text-red-500')}>{runRes.msg}</p>}
          {testRes && testRes.length > 0 && (
            <div className="rounded-lg border border-border divide-y divide-border/50">
              {testRes.map((r, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 text-[12px]">
                  {r.ok ? <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />}
                  <span className="font-medium text-foreground/60">{r.channel}</span>
                  <span className={r.ok ? 'text-emerald-600' : 'text-red-500'}>{r.msg}</span>
                </div>
              ))}
            </div>
          )}

          {job.lastRunAt && (
            <p className="text-[11px] text-muted-foreground">
              上次执行: {new Date(job.lastRunAt).toLocaleString('zh-CN')}
              {job.lastStatus && (job.lastStatus === 'success' ? ' ✅' : ' ❌')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
