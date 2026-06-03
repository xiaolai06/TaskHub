'use client';

import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { useCustomerList } from '@/hooks/useCustomers';
import type { CreateProjectInput, Project } from '@/hooks/useProjects';

const statusOptions = [
  { value: 'ACTIVE', label: '进行中' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'ARCHIVED', label: '已归档' },
];

const presetTypes = ['开发', '设计', '运营', '咨询', '维护', '其他'];

interface ProjectFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateProjectInput) => void;
  isLoading?: boolean;
  editProject?: Project | null;
}

export function ProjectForm({
  open,
  onClose,
  onSubmit,
  isLoading,
  editProject,
}: ProjectFormProps) {
  const { data: customersData } = useCustomerList();
  const customers = customersData?.data || [];

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [quote, setQuote] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [projectType, setProjectType] = useState('');
  const [customType, setCustomType] = useState('');
  const [expenseNote, setExpenseNote] = useState('');
  const [rewardNote, setRewardNote] = useState('');

  const isEdit = !!editProject;
  const inputCls = 'w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200';

  useEffect(() => {
    if (!editProject) {
      reset();
      return;
    }

    setName(editProject.name);
    setDescription(editProject.description || '');
    setStatus(editProject.status);
    setQuote(editProject.budget ? String(editProject.budget / 100) : '');
    setStartDate(editProject.startDate ? editProject.startDate.split('T')[0] : '');
    setEndDate(editProject.endDate ? editProject.endDate.split('T')[0] : '');
    setCustomerId(editProject.customerId || '');
    setExpenseNote(editProject.expenseNote || '');
    setRewardNote(editProject.rewardNote || '');

    if (editProject.type && presetTypes.includes(editProject.type)) {
      setProjectType(editProject.type);
      setCustomType('');
    } else if (editProject.type) {
      setProjectType('__custom__');
      setCustomType(editProject.type);
    } else {
      setProjectType('');
      setCustomType('');
    }
  }, [editProject]);

  function reset() {
    setName('');
    setDescription('');
    setStatus('ACTIVE');
    setQuote('');
    setStartDate('');
    setEndDate('');
    setCustomerId('');
    setProjectType('');
    setCustomType('');
    setExpenseNote('');
    setRewardNote('');
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    const finalType = projectType === '__custom__' ? customType.trim() : projectType;

    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      status,
      type: finalType || undefined,
      budget: quote ? Math.round(Number(quote) * 100) : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      customerId: customerId || undefined,
      expenseNote: expenseNote.trim() || undefined,
      rewardNote: rewardNote.trim() || undefined,
    });
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="text-base font-semibold text-foreground">
              {isEdit ? '编辑订单' : '新建订单'}
            </h2>
            <button
              type="button"
              onClick={() => {
                reset();
                onClose();
              }}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground/70"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="max-h-[75vh] overflow-y-auto px-6 py-5">
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground/80">
                  订单名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="输入订单名称"
                  required
                  className={inputCls}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground/80">
                  订单说明
                </label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="补充交付范围、关键约束和验收说明"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground/80">
                    订单类型
                  </label>
                  <select
                    value={projectType}
                    onChange={(event) => setProjectType(event.target.value)}
                    className={inputCls}
                  >
                    <option value="">未分类</option>
                    {presetTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                    <option value="__custom__">自定义...</option>
                  </select>
                  {projectType === '__custom__' ? (
                    <input
                      type="text"
                      value={customType}
                      onChange={(event) => setCustomType(event.target.value)}
                      placeholder="输入自定义类型"
                      className="mt-1.5 w-full rounded-lg border border-dashed border-indigo-300 px-3 py-2 text-sm text-foreground/80 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                    />
                  ) : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground/80">
                    状态
                  </label>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className={inputCls}
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground/80">
                    报价（元）
                  </label>
                  <input
                    type="number"
                    value={quote}
                    onChange={(event) => setQuote(event.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground/80">
                    关联客户
                  </label>
                  <select
                    value={customerId}
                    onChange={(event) => setCustomerId(event.target.value)}
                    className={inputCls}
                  >
                    <option value="">不关联客户</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.company ? `${customer.company}（${customer.name}）` : customer.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground/80">
                    开始日期
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground/80">
                    截止日期
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground/80">
                  成本备注
                </label>
                <textarea
                  value={expenseNote}
                  onChange={(event) => setExpenseNote(event.target.value)}
                  placeholder="记录外包、材料、差旅、服务器等成本背景"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground/80">
                  报价说明
                </label>
                <textarea
                  value={rewardNote}
                  onChange={(event) => setRewardNote(event.target.value)}
                  placeholder="记录合同金额结构、付款节点或补充约定"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  reset();
                  onClose();
                }}
                className="h-10 rounded-lg border border-border px-5 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isLoading || !name.trim()}
                className="flex h-10 items-center gap-1.5 rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white transition-all hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isEdit ? '保存修改' : '创建订单'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
