'use client';

import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { Loader2, Info, Sparkles } from 'lucide-react';
import type { Goal, MetricType, ProjectOption, CustomerOption } from '@/hooks/useGoals';
import { metricConfig, METRIC_CATEGORIES } from '@/components/features/goals/GoalCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';

const typeOptions = [
  { value: 'MONTHLY', label: '月度', autoRange: 'month' },
  { value: 'QUARTERLY', label: '季度', autoRange: 'quarter' },
  { value: 'YEARLY', label: '年度', autoRange: 'year' },
];

function getDefaultDates(type: string) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const start = new Date(y, m, 1);
  let end: Date;
  if (type === 'YEARLY') {
    start.setMonth(0, 1);
    end = new Date(y, 11, 31);
  } else if (type === 'QUARTERLY') {
    const qStart = Math.floor(m / 3) * 3;
    start.setMonth(qStart, 1);
    end = new Date(y, qStart + 3, 0);
  } else {
    end = new Date(y, m + 1, 0);
  }
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { start: fmt(start), end: fmt(end) };
}

const inputCls = 'w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60';
const labelCls = 'mb-1.5 block text-sm font-medium text-foreground/80';

interface GoalFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: unknown) => void;
  isLoading?: boolean;
  editGoal?: Goal | null;
  projects?: ProjectOption[];
  customers?: CustomerOption[];
}

export function GoalForm({
  open, onClose, onSubmit, isLoading, editGoal, projects = [], customers = [],
}: GoalFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('MONTHLY');
  const [metricType, setMetricType] = useState<MetricType>('REVENUE');
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState('元');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [projectId, setProjectId] = useState('');
  const [customerId, setCustomerId] = useState('');

  const isEdit = !!editGoal;
  const currentMetric = metricConfig[metricType as MetricType];
  const isCheckinType = metricType === 'HABIT_STREAK';

  useEffect(() => {
    if (!open) return;
    if (editGoal) {
      setTitle(editGoal.title);
      setDescription(editGoal.description || '');
      setType(editGoal.type);
      setMetricType(editGoal.metricType);
      setTargetValue(editGoal.targetValue ? String(editGoal.targetValue) : '');
      setUnit(editGoal.unit || '');
      setStartDate(editGoal.startDate.split('T')[0]);
      setEndDate(editGoal.endDate.split('T')[0]);
      setProjectId(editGoal.projectId || '');
      setCustomerId(editGoal.customerId || '');
    } else {
      reset();
    }
  }, [open]);

  useEffect(() => {
    if (isEdit || !currentMetric) return;
    setUnit(currentMetric.unit);
    if (metricType === 'MILESTONE' || metricType === 'HABIT_STREAK') setTargetValue('');
    if (!title) {
      const periodLabel = typeOptions.find(t => t.value === type)?.label || '月度';
      setTitle(`${periodLabel}${currentMetric.label}`);
    }
  }, [metricType]);

  useEffect(() => {
    if (isEdit) return;
    const dates = getDefaultDates(type);
    setStartDate(dates.start);
    setEndDate(dates.end);
  }, [type]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !startDate || !endDate) return;
    if (new Date(endDate) <= new Date(startDate)) {
      alert('结束日期必须晚于开始日期');
      return;
    }
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      type, metricType,
      progressMode: metricType === 'MILESTONE' ? 'MILESTONE' : metricType === 'HABIT_STREAK' ? 'CHECKIN' : undefined,
      targetValue: targetValue ? Number(targetValue) : null,
      unit: unit.trim() || null,
      startDate, endDate,
      projectId: projectId || null,
      customerId: customerId || null,
    });
  }

  function reset() {
    setTitle(''); setDescription(''); setType('MONTHLY'); setMetricType('REVENUE');
    setTargetValue(''); setUnit('元');
    const dates = getDefaultDates('MONTHLY');
    setStartDate(dates.start); setEndDate(dates.end);
    setProjectId(''); setCustomerId('');
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="flex flex-col max-h-[90vh] p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{isEdit ? '编辑目标' : '新建经营目标'}</DialogTitle>
          <DialogDescription>{isEdit ? '修改目标信息后将实时更新' : '设定目标类型和周期后创建'}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-4">
              {/* 指标类型 - 分组展示 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground/80">选择目标类型</label>
                <div className="space-y-3">
                  {METRIC_CATEGORIES.map(cat => (
                    <div key={cat.key}>
                      <p className="mb-1.5 text-2xs font-medium text-muted-foreground/70">{cat.label}</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {cat.metrics.map(m => {
                          const cfg = metricConfig[m];
                          return (
                            <button key={m} type="button" onClick={() => setMetricType(m)}
                              className={`flex flex-col items-center gap-0.5 rounded-lg border-2 px-2 py-2 text-center transition-all ${
                                metricType === m ? 'border-indigo-500 bg-indigo-50' : 'border-border hover:border-indigo-200'
                              }`}>
                              <span className="text-base">{cfg.icon}</span>
                              <span className={`text-2xs font-medium ${metricType === m ? 'text-indigo-700' : 'text-muted-foreground'}`}>{cfg.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {currentMetric && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Sparkles className="h-3 w-3" />{currentMetric.desc}
                  </p>
                )}
              </div>

              <div>
                <label className={labelCls}>目标名称 <span className="text-red-500">*</span></label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="如：6月收入达到3万" className={inputCls} required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>目标周期</label>
                  <Select value={type} onValueChange={(v) => setType(v || "MONTHLY")}>
                    <SelectTrigger className={cn(inputCls, "w-full")}>
                      <SelectValue placeholder="选择周期" />
                    </SelectTrigger>
                    <SelectContent>
                      {typeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}目标</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {metricType !== 'MILESTONE' && metricType !== 'HABIT_STREAK' && (
                  <div>
                    <label className={labelCls}>目标值 <span className="text-xs font-normal text-muted-foreground">({unit})</span></label>
                    <input type="number" value={targetValue} onChange={e => setTargetValue(e.target.value)}
                      placeholder={metricType === 'SATISFACTION' ? '0 ~ 100' : '0'}
                      min="0" max={metricType === 'SATISFACTION' ? '100' : undefined}
                      className={inputCls} required />
                    {metricType === 'SATISFACTION' && (
                      <p className="mt-1 text-2xs text-muted-foreground">0-100 分，建议目标 80 分以上</p>
                    )}
                  </div>
                )}
                {metricType === 'HABIT_STREAK' && (
                  <div>
                    <label className={labelCls}>期望打卡天数 <span className="text-xs font-normal text-muted-foreground">(天)</span></label>
                    <input type="number" value={targetValue} onChange={e => setTargetValue(e.target.value)} placeholder="如 30" min="1" className={inputCls} />
                  </div>
                )}
              </div>

              {(metricType === 'MILESTONE' || metricType === 'HABIT_STREAK') && (
                <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-600">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{metricType === 'HABIT_STREAK' ? '打卡类目标，每天签到即记录进度，可设置期望打卡天数' : '里程碑类型不需要设置目标值，进度将根据里程碑完成情况自动计算'}</span>
                </div>
              )}

              <div>
                <label className={labelCls}>范围限定 <span className="text-xs font-normal text-muted-foreground">（可选）</span></label>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={customerId} onValueChange={(v) => setCustomerId(v || "")}>
                    <SelectTrigger className={cn(inputCls, "w-full")}>
                      <SelectValue placeholder="全部客户" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={projectId} onValueChange={(v) => setProjectId(v || "")}>
                    <SelectTrigger className={cn(inputCls, "w-full")}>
                      <SelectValue placeholder="全部项目" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <p className="mt-1 text-2xs-plus text-muted-foreground">不限定则统计所有数据；选择客户则统计该客户下所有项目</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>开始日期 <span className="text-red-500">*</span></label>
                  <DatePicker value={startDate} onChange={setStartDate} />
                </div>
                <div>
                  <label className={labelCls}>结束日期 <span className="text-red-500">*</span></label>
                  <DatePicker value={endDate} onChange={setEndDate} />
                </div>
              </div>

              <div>
                <label className={labelCls}>备注</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="可选：记录目标背景或拆解思路" rows={2}
                  className="w-full resize-none rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
            <button type="button" onClick={() => { reset(); onClose(); }}
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted">取消</button>
            <button type="submit" disabled={isLoading || !title.trim() || !startDate || !endDate}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? '保存修改' : '创建目标'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
