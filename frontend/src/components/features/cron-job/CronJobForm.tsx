'use client';

import { useState } from 'react';
import { X, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CronJobFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; cronExpr: string; action: string; timezone: string; config: string }) => void;
  initial?: { name?: string; cronExpr?: string; action?: string; timezone?: string; config?: string };
}

const CRON_EXAMPLES = [
  { label: '每分钟(测试)', expr: '* * * * *' },
  { label: '每天 8:00', expr: '0 8 * * *' },
  { label: '每天 10:00', expr: '0 10 * * *' },
  { label: '每周一 9:00', expr: '0 9 * * 1' },
  { label: '每周日 20:00', expr: '0 20 * * 0' },
  { label: '每月 1 日 9:00', expr: '0 9 1 * *' },
];

export function CronJobForm({ open, onClose, onSave, initial }: CronJobFormProps) {
  const [name, setName] = useState(initial?.name || '');
  const [cronExpr, setCronExpr] = useState(initial?.cronExpr || '0 9 * * *');
  const [action, setAction] = useState(initial?.action || 'NOTIFY');
  const [timezone, setTimezone] = useState(initial?.timezone || 'Asia/Shanghai');
  const [config, setConfig] = useState(initial?.config || '{}');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await onSave({ name, cronExpr, action, timezone, config }); onClose(); }
    catch {} finally { setSaving(false); }
  }

  const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="mx-4 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">{initial ? '编辑定时任务' : '新建定时任务'}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-50"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">任务名称</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="如：每日提醒" className={inputCls} required maxLength={50} />
          </div>

          <div>
            <div className="mb-1 flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600">Cron 表达式</label>
              <span className="group relative flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 text-[10px] text-slate-400" title="">
                <HelpCircle className="h-3 w-3" />
                <div className="absolute bottom-full left-1/2 mb-1 hidden w-56 -translate-x-1/2 rounded-lg border bg-white p-2 text-[10px] text-slate-500 shadow group-hover:block">
                  格式: 分 时 日 月 周<br />分钟(0-59) 小时(0-23) 日(1-31) 月(1-12) 周(0-7)
                </div>
              </span>
            </div>
            <input value={cronExpr} onChange={e => setCronExpr(e.target.value)} className={cn(inputCls, 'font-mono')} required />
            <div className="mt-1 flex flex-wrap gap-1">
              {CRON_EXAMPLES.map(ex => (
                <button key={ex.expr} type="button" onClick={() => setCronExpr(ex.expr)}
                  className={cn('rounded-md border px-2 py-0.5 text-[10px] transition-colors', cronExpr === ex.expr ? 'border-indigo-300 bg-indigo-50 text-indigo-600' : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200')}>
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">动作类型</label>
              <select value={action} onChange={e => setAction(e.target.value)} className={inputCls}>
                <option value="NOTIFY">通知</option>
                <option value="AI_ANALYSIS">AI 分析</option>
                <option value="WEBHOOK">Webhook</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">时区</label>
              <select value={timezone} onChange={e => setTimezone(e.target.value)} className={inputCls}>
                <option value="Asia/Shanghai">Asia/Shanghai</option>
                <option value="Asia/Tokyo">Asia/Tokyo</option>
                <option value="America/New_York">America/New_York</option>
                <option value="Europe/London">Europe/London</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">配置 (JSON)</label>
            <textarea value={config} onChange={e => setConfig(e.target.value)} className={cn(inputCls, 'h-20 font-mono text-[12px]')} placeholder='{"key":"value"}' />
          </div>

          <button type="submit" disabled={saving}
            className="flex w-full items-center justify-center rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white transition-all hover:bg-indigo-700 disabled:opacity-50">
            {saving ? '保存中...' : '保存'}
          </button>
        </form>
      </div>
    </div>
  );
}
