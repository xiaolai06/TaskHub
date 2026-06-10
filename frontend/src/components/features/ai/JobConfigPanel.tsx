'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, ChevronDown, ChevronRight, Clock, Play,
  CheckCircle, XCircle, Cpu, Save, Zap, Settings,
  Mail, Bell, Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import {
  useCronJobs, useUpdateCronJob, useRunJob, useTestNotify,
  type CronJob,
} from '@/hooks/useCronJobs';

const CRON_PRESETS = [
  { label: '每天 7:30', expr: '30 7 * * *' },
  { label: '每天 8:00', expr: '0 8 * * *' },
  { label: '每天 8:30', expr: '30 8 * * *' },
  { label: '每天 9:00', expr: '0 9 * * *' },
  { label: '每天 9:30', expr: '30 9 * * *' },
  { label: '每天 10:00', expr: '0 10 * * *' },
  { label: '每周一 9:00', expr: '0 9 * * 1' },
  { label: '每周日 20:00', expr: '0 20 * * 0' },
];

const CRON_LABELS: Record<string, string> = {
  '30 7 * * *': '每天 07:30', '0 8 * * *': '每天 08:00', '30 8 * * *': '每天 08:30',
  '0 9 * * *': '每天 09:00', '30 9 * * *': '每天 09:30', '0 10 * * *': '每天 10:00',
  '0 9 * * 1': '每周一 09:00', '0 10 * * 0': '每周日 10:00', '0 20 * * 0': '每周日 20:00',
};

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

/** 从 settings API 获取 webhook 列表 */
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

/** 从 settings API 获取 AI 模型列表 */
async function fetchModels(): Promise<AIModel[]> {
  try {
    const list = await api.get<Array<{ provider: string; label: string; models: Array<{ id: string; name: string }> }>>('/settings/ai/all-models');
    const out: AIModel[] = [];
    for (const g of list) for (const m of g.models) out.push({ id: m.id, name: m.name, providerLabel: g.label });
    return out;
  } catch { return []; }
}

// ═══ 开关 ═══

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      className={cn('relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors', on ? 'bg-indigo-600' : 'bg-accent')}>
      <span className={cn('h-3 w-3 rounded-full bg-card shadow transition-transform', on ? 'translate-x-3.5' : 'translate-x-0.5')} />
    </button>
  );
}

// ═══ 通知行 ═══

function NRow({ icon, label, sub, children }: { icon: React.ReactNode; label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-1">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[13px] shrink-0">{icon}</span>
        <span className="text-[12px] text-foreground/80">{label}</span>
        {sub && <span className="text-[10px] text-muted-foreground/50">{sub}</span>}
      </div>
      {children}
    </div>
  );
}

// ═══ 单个任务卡片 ═══

function JobCard({ job, models, webhooks, onToggle }: {
  job: CronJob; models: AIModel[]; webhooks: WH[]; onToggle: () => void;
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

  const icon = JOB_ICONS[job.name] || '⚡';
  const cfg = parseConfig(job.config);

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
  }, [job.id, tMut]);

  return (
    <div className={cn('rounded-lg border bg-card', job.enabled ? 'border-border' : 'opacity-50')}>
      {/* ── 标题行 ── */}
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left">
        <span className={cn('shrink-0', job.enabled ? 'text-emerald-500' : 'text-muted-foreground/40')}
          onClick={e => { e.stopPropagation(); onToggle(); }}>
          {job.enabled ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        </span>
        <span className="text-[13px]">{icon}</span>
        <span className="min-w-0 flex-1 text-[12px] font-semibold text-foreground truncate">{job.name}</span>
        <span className="flex items-center gap-1 shrink-0">
          {emailOn && <Mail className="h-3 w-3 text-emerald-500" />}
          {targets.length > 0 && <span className="text-[10px] text-blue-500">+{targets.length}</span>}
          <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </span>
      </button>

      {/* ── 展开面板 ── */}
      {open && (
        <div className="border-t border-border/60 px-3 pb-3 pt-2 space-y-3">
          {/* 频率 */}
          <div>
            <p className="mb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">执行频率</p>
            <input value={cron} onChange={e => setCron(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px] outline-none focus:border-indigo-300" />
            <div className="mt-1.5 flex flex-wrap gap-1">
              {CRON_PRESETS.map(p => (
                <button key={p.expr} type="button" onClick={() => setCron(p.expr)}
                  className={cn('rounded border px-1.5 py-0.5 text-[10px] transition-colors',
                    cron === p.expr ? 'border-indigo-300 bg-indigo-50 text-indigo-600' : 'border-border text-muted-foreground hover:border-indigo-200')}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* 通知 */}
          <div>
            <p className="mb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">通知渠道</p>
            <div className="rounded-md border border-border/60 bg-background">
              <NRow icon="📧" label="邮件"><Toggle on={emailOn} onChange={setEmailOn} /></NRow>
              {webhooks.length > 0 && <div className="border-t border-border/40 mx-2" />}
              {webhooks.map(wh => (
                <NRow key={wh.name} icon={CH_ICONS[wh.channel] || '🔗'} label={wh.name} sub={wh.channel}>
                  <input type="checkbox" checked={targets.includes(wh.name)} onChange={() => toggleWH(wh.name)}
                    className="h-3.5 w-3.5 rounded border-border text-indigo-600" />
                </NRow>
              ))}
              {webhooks.length === 0 && (
                <>
                  <div className="border-t border-border/40 mx-2" />
                  <p className="px-3 py-1.5 text-[10px] text-muted-foreground/50">暂无推送目标，去系统设置添加</p>
                </>
              )}
            </div>
          </div>

          {/* AI 模型 */}
          {job.action === 'AI_ANALYSIS' && (
            <div>
              <p className="mb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">AI 模型</p>
              <select value={model} onChange={e => setModel(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[11px] outline-none focus:border-indigo-300">
                <option value="">使用默认</option>
                {models.map(m => <option key={m.id} value={m.id}>{m.name} ({m.providerLabel})</option>)}
              </select>
            </div>
          )}

          {/* 操作 */}
          <div className="flex items-center gap-1.5 pt-1">
            <button onClick={handleRun} disabled={rMut.isPending}
              className="flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-[11px] font-medium text-foreground/60 hover:bg-accent disabled:opacity-50">
              {rMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}执行
            </button>
            <button onClick={handleTest} disabled={tMut.isPending}
              className="flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-[11px] font-medium text-foreground/60 hover:bg-accent disabled:opacity-40">
              {tMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}测试
            </button>
            <div className="flex-1" />
            <button onClick={handleSave} disabled={saving || !dirty}
              className={cn('flex items-center gap-1 rounded-md px-3 py-1.5 text-[11px] font-medium transition-all disabled:opacity-40',
                dirty ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-muted text-muted-foreground')}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              {saved ? '已保存' : '保存'}
            </button>
          </div>

          {/* 结果 */}
          {runRes && <p className={cn('text-[11px]', runRes.ok ? 'text-emerald-500' : 'text-red-500')}>{runRes.msg}</p>}
          {testRes && testRes.length > 0 && (
            <div className="rounded-md border border-border/60 bg-muted/30 px-2 py-1.5 space-y-0.5">
              {testRes.map((r, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[10px]">
                  {r.ok ? <CheckCircle className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
                  <span className="font-medium text-foreground/50">{r.channel}</span>
                  <span className={r.ok ? 'text-emerald-600' : 'text-red-500'}>{r.msg}</span>
                </div>
              ))}
            </div>
          )}

          {job.lastRunAt && (
            <p className="text-[10px] text-muted-foreground">
              上次 {new Date(job.lastRunAt).toLocaleString('zh-CN')}
              {job.lastStatus && (job.lastStatus === 'success' ? ' ✅' : ' ❌')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ═══ 主面板 ═══

export function JobConfigPanel() {
  const { data: jobs, isLoading } = useCronJobs();
  const updateMut = useUpdateCronJob();
  const [models, setModels] = useState<AIModel[]>([]);
  const [webhooks, setWebhooks] = useState<WH[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let off = false;
    fetchModels().then(m => { if (!off) setModels(m); });
    fetchWebhooks().then(w => { if (!off) setWebhooks(w); });
    return () => { off = true; };
  }, []);

  const sj = jobs?.filter(j => j.isSystem) || [];
  if (isLoading) return <div className="flex items-center gap-2 py-2"><Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /><span className="text-[11px] text-muted-foreground">加载中...</span></div>;
  if (sj.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <button onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground/70">
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        <Zap className="h-3 w-3" />定时任务
        <span className="ml-auto text-[9px] font-normal text-muted-foreground/50">{sj.filter(j => j.enabled).length}/{sj.length}</span>
      </button>
      {!collapsed && sj.map(job => (
        <JobCard key={job.id} job={job} models={models} webhooks={webhooks}
          onToggle={() => updateMut.mutate({ id: job.id, data: { enabled: !job.enabled } })} />
      ))}
    </div>
  );
}
