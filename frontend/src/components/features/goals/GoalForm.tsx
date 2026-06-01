'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Info, Sparkles } from 'lucide-react';
import type { Goal, MetricType, ProjectOption, CustomerOption } from '@/hooks/useGoals';

const typeOptions = [
  { value: 'MONTHLY', label: '月度', autoRange: 'month' },
  { value: 'QUARTERLY', label: '季度', autoRange: 'quarter' },
  { value: 'YEARLY', label: '年度', autoRange: 'year' },
];

const metricOptions: { value: MetricType; label: string; unit: string; hint: string; icon: string }[] = [
  { value: 'REVENUE', label: '收入目标', unit: '元', hint: '追踪已完成订单的回款', icon: '💰' },
  { value: 'PROFIT', label: '利润目标', unit: '元', hint: '追踪订单实际利润（收入-成本）', icon: '📈' },
  { value: 'NEW_ORDERS', label: '新订单目标', unit: '个', hint: '追踪新接订单数量', icon: '📦' },
  { value: 'PROJECT_COUNT', label: '完成目标', unit: '个', hint: '追踪按时完成的项目数', icon: '✅' },
  { value: 'DELIVERY_RATE', label: '交付率目标', unit: '%', hint: '追踪按时交付的比例', icon: '🎯' },
  { value: 'MILESTONE', label: '里程碑', unit: '', hint: '按里程碑节点追踪进度', icon: '🏁' },
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
  const currentMetric = metricOptions.find(m => m.value === metricType);

  // 编辑模式填充
  useEffect(() => {
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
  }, [editGoal]);

  // 指标变化 → 自动填充单位和标题建议
  useEffect(() => {
    if (isEdit || !currentMetric) return;
    setUnit(currentMetric.unit);
    if (currentMetric.value === 'MILESTONE') setTargetValue('');
    // 自动生成标题
    if (!title) {
      const periodLabel = typeOptions.find(t => t.value === type)?.label || '月度';
      setTitle(`${periodLabel}${currentMetric.label.replace('目标', '')}`);
    }
  }, [metricType]);

  // 周期变化 → 自动填充日期
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
      type,
      metricType,
      targetValue: targetValue ? Number(targetValue) : null,
      unit: unit.trim() || null,
      startDate,
      endDate,
      projectId: projectId || null,
      customerId: customerId || null,
    });
  }

  function reset() {
    setTitle('');
    setDescription('');
    setType('MONTHLY');
    setMetricType('REVENUE');
    setTargetValue('');
    setUnit('元');
    const dates = getDefaultDates('MONTHLY');
    setStartDate(dates.start);
    setEndDate(dates.end);
    setProjectId('');
    setCustomerId('');
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
          {/* 头部 */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
            <h2 className="text-base font-semibold text-slate-800">
              {isEdit ? '编辑目标' : '新建经营目标'}
            </h2>
            <button onClick={() => { reset(); onClose(); }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5">
            <div className="space-y-4">
              {/* 指标类型选择 - 卡片式 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">选择目标类型</label>
                <div className="grid grid-cols-3 gap-2">
                  {metricOptions.map(m => (
                    <button key={m.value} type="button"
                      onClick={() => setMetricType(m.value)}
                      className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 text-center transition-all ${
                        metricType === m.value
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}>
                      <span className="text-lg">{m.icon}</span>
                      <span className={`text-xs font-medium ${
                        metricType === m.value ? 'text-indigo-700' : 'text-slate-600'
                      }`}>{m.label}</span>
                    </button>
                  ))}
                </div>
                {currentMetric && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
                    <Sparkles className="h-3 w-3" />{currentMetric.hint}
                  </p>
                )}
              </div>

              {/* 目标标题 */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  目标名称 <span className="text-red-500">*</span>
                </label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="如：6月收入达到3万 / Q2利润目标5万"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
                  required />
              </div>

              {/* 周期 + 目标值 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">目标周期</label>
                  <select value={type} onChange={e => setType(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200">
                    {typeOptions.map(o => <option key={o.value} value={o.value}>{o.label}目标</option>)}
                  </select>
                </div>
                {metricType !== 'MILESTONE' && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      目标值 <span className="text-xs font-normal text-slate-400">({unit})</span>
                    </label>
                    <input type="number" value={targetValue} onChange={e => setTargetValue(e.target.value)}
                      placeholder="0" min="0"
                      className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
                      required />
                  </div>
                )}
              </div>

              {metricType === 'MILESTONE' && (
                <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-600">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>里程碑类型不需要设置目标值，进度将根据里程碑完成情况自动计算</span>
                </div>
              )}

              {/* 范围限定 */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  范围限定 <span className="text-xs font-normal text-slate-400">（可选）</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <select value={customerId} onChange={e => setCustomerId(e.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200">
                    <option value="">全部客户</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>
                    ))}
                  </select>
                  <select value={projectId} onChange={e => setProjectId(e.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200">
                    <option value="">全部项目</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  不限定则统计所有数据；选择客户则统计该客户下所有项目
                </p>
              </div>

              {/* 时间范围 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    开始日期 <span className="text-red-500">*</span>
                  </label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
                    required />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    结束日期 <span className="text-red-500">*</span>
                  </label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
                    required />
                </div>
              </div>

              {/* 描述 */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">备注</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="可选：记录目标背景或拆解思路"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200" />
              </div>
            </div>

            {/* 按钮 */}
            <div className="mt-6 flex justify-end gap-2.5">
              <button type="button" onClick={() => { reset(); onClose(); }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                取消
              </button>
              <button type="submit"
                disabled={isLoading || !title.trim() || !startDate || !endDate}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 active:scale-95 disabled:opacity-50">
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEdit ? '保存修改' : '创建目标'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
