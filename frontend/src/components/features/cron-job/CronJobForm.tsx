'use client';

import { useState, useEffect } from 'react';
import { Bell, Bot, Clock, ChevronDown, Calendar, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AI_TEMPLATES, type AIModel, type WH } from '@/components/features/cron-job/cron-utils';

interface CronJobFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; cronExpr: string; action: string; timezone: string; config: string }) => void;
  initial?: { name?: string; cronExpr?: string; action?: string; timezone?: string; config?: string; aiModel?: string };
  webhooks?: WH[];
  models?: AIModel[];
}

const inputCls = 'w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60';

// ─── 重复选项 ───
const QUICK_REPEATS = [
  { label: '每天', value: 'daily', icon: '☀️' },
  { label: '工作日', value: 'weekdays', icon: '💼' },
  { label: '每周一', value: 'weekly-mon', icon: '📅' },
  { label: '每周五', value: 'weekly-fri', icon: '🎉' },
  { label: '每周日', value: 'weekly-sun', icon: '🌅' },
  { label: '每月1号', value: 'monthly', icon: '📆' },
  { label: '自定义', value: 'custom', icon: '⚙️' },
];

// ─── 自定义间隔选项 ───
const CUSTOM_INTERVALS = [
  { label: '每小时', cron: '0 * * * *' },
  { label: '每 2 小时', cron: '0 */2 * * *' },
  { label: '每 4 小时', cron: '0 */4 * * *' },
  { label: '每 6 小时', cron: '0 */6 * * *' },
  { label: '每 12 小时', cron: '0 */12 * * *' },
  { label: '每周二、四', cron: '0 9 * * 2,4' },
  { label: '每周一、三、五', cron: '0 9 * * 1,3,5' },
  { label: '每季度首日', cron: '0 9 1 1,4,7,10 *' },
];

// ─── 预制提醒模板 ───
const MESSAGE_TEMPLATES = [
  { icon: '📋', label: '周报提醒', message: '📝 该写周报了！回顾本周完成的任务，规划下周工作重点，别忘了更新项目进度。' },
  { icon: '💰', label: '回款跟进', message: '💰 提醒：检查本周应收款，跟进未回款项目，确认客户付款计划。' },
  { icon: '⏰', label: '任务到期', message: '⏰ 有任务即将到期，请检查待办列表，优先处理紧急事项。' },
  { icon: '🤝', label: '客户回访', message: '🤝 该回访客户了！了解项目进展、收集反馈、维护客户关系。' },
  { icon: '📊', label: '数据核对', message: '📊 月末数据核对：检查项目成本、收入确认、利润统计是否准确。' },
  { icon: '🎯', label: '目标复盘', message: '🎯 本周目标复盘：对比实际完成与计划目标，调整下周策略。' },
  { icon: '☕', label: '休息提醒', message: '☕ 工作辛苦了！起来活动一下，喝杯水，保持良好状态。' },
];

// ─── Cron 解析/生成 ───

function parseCronToFreq(cronExpr: string): { freq: string; time: string; customCron: string; isCustom: boolean } {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return { freq: 'daily', time: '09:00', customCron: cronExpr, isCustom: false };
  const [min, hour, dom, mon, dow] = parts;

  // 检查是否是自定义间隔
  const isInterval = min === '0' && (hour.startsWith('*/') || hour === '*') && dom === '*' && mon === '*';
  const isMultiDow = dow.includes(',');

  if (isInterval || isMultiDow || (dom !== '*' && dom !== '1')) {
    return { freq: 'custom', time: `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`, customCron: cronExpr, isCustom: true };
  }

  const time = `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
  if (dow === '1-5') return { freq: 'weekdays', time, customCron: '', isCustom: false };
  if (dow === '1') return { freq: 'weekly-mon', time, customCron: '', isCustom: false };
  if (dow === '5') return { freq: 'weekly-fri', time, customCron: '', isCustom: false };
  if (dow === '0') return { freq: 'weekly-sun', time, customCron: '', isCustom: false };
  if (dom === '1' && mon === '*') return { freq: 'monthly', time, customCron: '', isCustom: false };
  return { freq: 'daily', time, customCron: '', isCustom: false };
}

function buildCronExpr(freq: string, time: string, customCron: string): string {
  if (freq === 'custom') return customCron;
  const [h, m] = time.split(':');
  switch (freq) {
    case 'daily': return `${m} ${h} * * *`;
    case 'weekdays': return `${m} ${h} * * 1-5`;
    case 'weekly-mon': return `${m} ${h} * * 1`;
    case 'weekly-fri': return `${m} ${h} * * 5`;
    case 'weekly-sun': return `${m} ${h} * * 0`;
    case 'monthly': return `${m} ${h} 1 * *`;
    default: return `${m} ${h} * * *`;
  }
}

// ─── 时间选择器组件 ───

function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [hour, minute] = value.split(':').map(Number);

  const setHour = (h: number) => {
    const hh = Math.max(0, Math.min(23, h));
    onChange(`${String(hh).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  };
  const setMinute = (m: number) => {
    const mm = Math.max(0, Math.min(59, m));
    onChange(`${String(hour).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  return (
    <div className="flex items-center gap-3">
      {/* 时 */}
      <div className="flex flex-col items-center">
        <button type="button" onClick={() => setHour(hour + 1)}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <ChevronDown className="h-4 w-4 rotate-180" />
        </button>
        <div className="w-14 rounded-lg border-2 border-indigo-200 bg-indigo-50/50 py-1.5 text-center">
          <span className="font-mono text-2xl font-bold text-indigo-700">{String(hour).padStart(2, '0')}</span>
        </div>
        <button type="button" onClick={() => setHour(hour - 1)}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <ChevronDown className="h-4 w-4" />
        </button>
        <span className="mt-0.5 text-2xs text-muted-foreground/50">时</span>
      </div>

      <span className="text-2xl font-bold text-muted-foreground/30 select-none pb-4">:</span>

      {/* 分 */}
      <div className="flex flex-col items-center">
        <button type="button" onClick={() => setMinute(minute + 5)}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <ChevronDown className="h-4 w-4 rotate-180" />
        </button>
        <div className="w-14 rounded-lg border-2 border-indigo-200 bg-indigo-50/50 py-1.5 text-center">
          <span className="font-mono text-2xl font-bold text-indigo-700">{String(minute).padStart(2, '0')}</span>
        </div>
        <button type="button" onClick={() => setMinute(minute - 5)}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <ChevronDown className="h-4 w-4" />
        </button>
        <span className="mt-0.5 text-2xs text-muted-foreground/50">分</span>
      </div>

      {/* 快捷时间 */}
      <div className="ml-2 flex flex-col gap-1">
        {['08:00', '09:00', '10:00', '14:00', '18:00'].map(t => (
          <button key={t} type="button" onClick={() => onChange(t)}
            className={cn('rounded-md px-2 py-0.5 text-2xs font-mono transition-all',
              value === t ? 'bg-indigo-100 text-indigo-700 font-semibold' : 'text-muted-foreground hover:bg-muted')}>
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── 主表单 ───

export function CronJobForm({ open, onClose, onSave, initial }: CronJobFormProps) {
  const [name, setName] = useState('');
  const [action, setAction] = useState<'NOTIFY' | 'AI_ANALYSIS'>('NOTIFY');
  const [freq, setFreq] = useState('daily');
  const [time, setTime] = useState('09:00');
  const [customCron, setCustomCron] = useState('');
  const [message, setMessage] = useState('');
  const [aiTemplate, setAiTemplate] = useState('project-progress');
  const [customPrompt, setCustomPrompt] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name || '');
      setAction((initial.action as 'NOTIFY' | 'AI_ANALYSIS') || 'NOTIFY');
      if (initial.cronExpr) {
        const parsed = parseCronToFreq(initial.cronExpr);
        setFreq(parsed.freq);
        setTime(parsed.time);
        setCustomCron(parsed.customCron);
      }
      try {
        const cfg = JSON.parse(initial.config || '{}');
        if (cfg.message) setMessage(cfg.message as string);
        if (cfg.aiTemplate) setAiTemplate(cfg.aiTemplate);
        if (cfg.customPrompt) setCustomPrompt(cfg.customPrompt);
      } catch { /* noop */ }
    } else {
      setName(''); setAction('NOTIFY'); setFreq('daily'); setTime('09:00');
      setCustomCron(''); setMessage(''); setAiTemplate('project-progress'); setCustomPrompt('');
    }
  }, [initial, open]);

  const cronExpr = buildCronExpr(freq, time, customCron);

  async function handleSubmit() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const config: Record<string, unknown> = { message: message.trim() };
      if (action === 'AI_ANALYSIS') {
        config.aiTemplate = aiTemplate;
        if (aiTemplate === 'custom') config.customPrompt = customPrompt;
      }
      await onSave({ name, cronExpr, action, timezone: 'Asia/Shanghai', config: JSON.stringify(config) });
      onClose();
    } catch { /* noop */ }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="flex flex-col max-h-[90vh] p-0 sm:max-w-lg">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>{initial ? '编辑定时任务' : '新建定时'}</DialogTitle>
          <DialogDescription>选择类型和时间，到点自动执行</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* ═══ 类型 ═══ */}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setAction('NOTIFY')}
              className={cn('flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-2.5 transition-all',
                action === 'NOTIFY' ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-border text-muted-foreground hover:border-blue-200')}>
              <Bell className="h-4.5 w-4.5" />
              <span className="text-xs font-semibold">消息通知</span>
            </button>
            <button type="button" onClick={() => setAction('AI_ANALYSIS')}
              className={cn('flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-2.5 transition-all',
                action === 'AI_ANALYSIS' ? 'border-purple-400 bg-purple-50 text-purple-700' : 'border-border text-muted-foreground hover:border-purple-200')}>
              <Bot className="h-4.5 w-4.5" />
              <span className="text-xs font-semibold">报表分析</span>
            </button>
          </div>

          {/* ═══ 名称 ═══ */}
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground/70">任务名称</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder={action === 'AI_ANALYSIS' ? '如：每日项目进展汇总' : '如：周报提醒'}
              className={inputCls} maxLength={50} />
          </div>

          {/* ═══ 时间选择 ═══ */}
          <div>
            <label className="mb-3 flex items-center gap-1.5 text-xs font-medium text-foreground/70">
              <Clock className="h-3.5 w-3.5" />设定时间
            </label>

            {/* 时间滚轮 + 快捷时间 */}
            <div className="flex items-start justify-center">
              <TimePicker value={time} onChange={setTime} />
            </div>

            {/* 重复频率 chips */}
            <div className="mt-4">
              <p className="mb-2 flex items-center gap-1 text-2xs font-medium text-muted-foreground/60">
                <Repeat className="h-3 w-3" />重复
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_REPEATS.map(opt => (
                  <button key={opt.value} type="button" onClick={() => setFreq(opt.value)}
                    className={cn('flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                      freq === opt.value
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                        : 'bg-muted/60 text-muted-foreground hover:bg-indigo-50 hover:text-indigo-600')}>
                    <span className="text-sm">{opt.icon}</span>{opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 自定义间隔 */}
            {freq === 'custom' && (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {CUSTOM_INTERVALS.map(opt => (
                    <button key={opt.cron} type="button" onClick={() => setCustomCron(opt.cron)}
                      className={cn('rounded-full border px-2.5 py-1 text-2xs transition-all',
                        customCron === opt.cron
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                          : 'border-border text-muted-foreground hover:border-indigo-200')}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <input value={customCron} onChange={e => setCustomCron(e.target.value)}
                  placeholder="0 9 * * *（高级：手动输入 cron）"
                  className={cn(inputCls, 'font-mono text-xs')} />
              </div>
            )}

            <p className="mt-2 text-center text-2xs text-muted-foreground/50">
              <Calendar className="inline h-3 w-3 mr-1" />
              {describeCronFriendly(cronExpr)}
            </p>
          </div>

          {/* ═══ 消息通知：内容 + 模板 ═══ */}
          {action === 'NOTIFY' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground/70">通知内容</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)}
                placeholder="输入通知内容，或从下方模板快速选择..."
                className={cn(inputCls, 'h-20 resize-none')}
                maxLength={500} />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {MESSAGE_TEMPLATES.map(tmpl => (
                  <button key={tmpl.label} type="button" onClick={() => setMessage(tmpl.message)}
                    className={cn('flex items-center gap-1 rounded-full border px-2.5 py-1 text-2xs transition-all',
                      message === tmpl.message
                        ? 'border-blue-300 bg-blue-50 text-blue-700'
                        : 'border-border text-muted-foreground hover:border-blue-200')}>
                    <span>{tmpl.icon}</span>{tmpl.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ═══ 报表分析：模板 + prompt ═══ */}
          {action === 'AI_ANALYSIS' && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground/70">分析模板</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {AI_TEMPLATES.map(tmpl => (
                    <button key={tmpl.id} type="button" onClick={() => setAiTemplate(tmpl.id)}
                      className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all',
                        aiTemplate === tmpl.id ? 'border-purple-300 bg-purple-50 text-purple-700' : 'border-border text-muted-foreground hover:border-purple-200')}>
                      <span className="text-sm">{tmpl.icon}</span>
                      <span className="text-2xs font-medium">{tmpl.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              {aiTemplate === 'custom' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground/70">自定义 Prompt</label>
                  <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)}
                    className={cn(inputCls, 'h-20 resize-none')}
                    placeholder="告诉 AI 你需要分析什么数据..." />
                </div>
              )}
            </>
          )}
        </div>

        {/* 底部 */}
        <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">取消</button>
          <button type="button" disabled={saving || !name.trim()} onClick={handleSubmit}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? '保存中...' : initial ? '保存' : '创建'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 友好的 cron 描述 ───

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function describeCronFriendly(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;
  const [min, hour, dom, mon, dow] = parts;

  if (expr === '* * * * *') return '每分钟执行';
  if (min === '0' && hour === '*') return '每小时整点执行';

  const time = `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;

  if (dow === '1-5') return `工作日 ${time} 执行`;
  if (dow.includes(',')) {
    const days = dow.split(',').map(d => `周${WEEKDAYS[parseInt(d)] || d}`);
    return `${days.join('、')} ${time} 执行`;
  }
  if (dow !== '*' && dom === '*') {
    const dayName = WEEKDAYS[parseInt(dow)] || dow;
    return `每周${dayName} ${time} 执行`;
  }
  if (dom === '1' && mon === '*') return `每月 1 日 ${time} 执行`;
  if (dom !== '*' && mon === '*') return `每月 ${dom} 日 ${time} 执行`;
  if (hour.startsWith('*/')) return `每 ${hour.slice(2)} 小时执行`;

  return `每天 ${time} 执行`;
}
