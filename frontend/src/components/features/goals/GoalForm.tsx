'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Info } from 'lucide-react';
import type { Goal, ProjectOption, CustomerOption } from '@/hooks/useGoals';

const typeOptions = [
  { value: 'MONTHLY', label: '月度目标' },
  { value: 'QUARTERLY', label: '季度目标' },
  { value: 'YEARLY', label: '年度目标' },
];

const metricOptions = [
  { value: 'REVENUE', label: '收入', unit: '元', needValue: true },
  { value: 'PROJECT_COUNT', label: '项目数', unit: '个', needValue: true },
  { value: 'CLIENT_COUNT', label: '客户数', unit: '个', needValue: true },
  { value: 'HOURS', label: '工时', unit: '小时', needValue: true },
  { value: 'PERCENTAGE', label: '百分比', unit: '%', needValue: true },
  { value: 'MILESTONE', label: '里程碑', unit: '', needValue: false },
];

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
  open,
  onClose,
  onSubmit,
  isLoading,
  editGoal,
  projects = [],
  customers = [],
}: GoalFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('MONTHLY');
  const [metricType, setMetricType] = useState('MILESTONE');
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [projectId, setProjectId] = useState('');
  const [customerId, setCustomerId] = useState('');

  const isEdit = !!editGoal;
  const currentMetric = metricOptions.find(m => m.value === metricType);

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

  // 指标类型变化时自动填充单位
  useEffect(() => {
    if (!isEdit && currentMetric) {
      setUnit(currentMetric.unit);
      if (currentMetric.value === 'MILESTONE') {
        setTargetValue('');
      }
    }
  }, [metricType, isEdit, currentMetric]);

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
    setMetricType('MILESTONE');
    setTargetValue('');
    setUnit('');
    setStartDate('');
    setEndDate('');
    setProjectId('');
    setCustomerId('');
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
          {/* 头部 */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
            <h2 className="text-base font-semibold text-slate-800">
              {isEdit ? '编辑目标' : '新建目标'}
            </h2>
            <button
              onClick={() => { reset(); onClose(); }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="px-6 py-5">
            <div className="space-y-4">
              {/* 目标标题 */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  目标标题 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="如：5月收入达到3万 / 完成技术博客"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
                  required
                />
              </div>

              {/* 描述 */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">目标描述</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="简要描述目标内容"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
                />
              </div>

              {/* 目标周期 + 指标类型 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">目标周期</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
                  >
                    {typeOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">指标类型</label>
                  <select
                    value={metricType}
                    onChange={(e) => setMetricType(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
                  >
                    {metricOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 指标类型说明 */}
              {metricType === 'MILESTONE' && (
                <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-600">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>里程碑类型目标不需要设置目标值，进度将根据里程碑完成情况自动计算</span>
                </div>
              )}

              {/* 目标值 + 单位（MILESTONE 类型不显示） */}
              {metricType !== 'MILESTONE' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">目标值</label>
                    <input
                      type="number"
                      value={targetValue}
                      onChange={(e) => setTargetValue(e.target.value)}
                      placeholder="0"
                      min="0"
                      step={metricType === 'PERCENTAGE' ? '1' : '1'}
                      className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">单位</label>
                    <input
                      type="text"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="元/个/%"
                      className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* 关联客户 */}
              {customers.length > 0 && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    关联客户 <span className="text-xs font-normal text-slate-500">（可选）</span>
                  </label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
                  >
                    <option value="">不关联客户</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.company ? ` (${c.company})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-500">
                    关联客户后，将统计该客户下所有项目的数据
                  </p>
                </div>
              )}

              {/* 关联项目 */}
              {projects.length > 0 && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    关联项目 <span className="text-xs font-normal text-slate-500">（可选）</span>
                  </label>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
                  >
                    <option value="">不关联项目</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.status === 'COMPLETED' ? '✅' : p.status === 'ACTIVE' ? '🔄' : '📁'}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-500">
                    关联项目后，将只统计该项目的数据
                  </p>
                </div>
              )}

              {/* 时间范围 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    开始日期 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    结束日期 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
                    required
                  />
                </div>
              </div>
            </div>

            {/* 按钮 */}
            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => { reset(); onClose(); }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isLoading || !title.trim() || !startDate || !endDate}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 active:scale-95 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
              >
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
