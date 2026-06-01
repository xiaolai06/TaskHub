'use client';

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
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

export function ProjectForm({ open, onClose, onSubmit, isLoading, editProject }: ProjectFormProps) {
  const { data: customersData } = useCustomerList();
  const customers = customersData?.data || [];
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [budget, setBudget] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [projectType, setProjectType] = useState('');
  const [customType, setCustomType] = useState('');
  const [expenseNote, setExpenseNote] = useState('');

  const isEdit = !!editProject;
  const showCustomType = !presetTypes.includes(projectType) && projectType !== '';

  useEffect(() => {
    if (editProject) {
      setName(editProject.name);
      setDescription(editProject.description || '');
      setStatus(editProject.status);
      setBudget(editProject.budget ? String(editProject.budget / 100) : '');
      setStartDate(editProject.startDate ? editProject.startDate.split('T')[0] : '');
      setEndDate(editProject.endDate ? editProject.endDate.split('T')[0] : '');
      setCustomerId(editProject.customerId || '');
      if (editProject.type && presetTypes.includes(editProject.type)) {
        setProjectType(editProject.type);
        setCustomType('');
      } else if (editProject.type) {
        setProjectType('__custom__');
        setCustomType(editProject.type);
      }
      setExpenseNote(editProject.expenseNote || '');
    } else {
      reset();
    }
  }, [editProject]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const finalType = projectType === '__custom__' ? customType.trim() : projectType;
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      status,
      type: finalType || undefined,
      budget: budget ? Number(budget) * 100 : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      customerId: customerId || undefined,
      expenseNote: expenseNote.trim() || undefined,
    });
  }

  function reset() {
    setName(''); setDescription(''); setStatus('ACTIVE');
    setBudget(''); setStartDate(''); setEndDate('');
    setCustomerId(''); setProjectType(''); setCustomType('');
    setExpenseNote('');
  }

  if (!open) return null;

  const inputCls = 'w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200';
  const selectCls = 'w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200';

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="text-base font-semibold text-slate-800">{isEdit ? '编辑项目' : '新建项目'}</h2>
            <button onClick={() => { reset(); onClose(); }} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="max-h-[75vh] overflow-y-auto px-6 py-5">
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">项目名称 <span className="text-red-500">*</span></label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="输入项目名称" required className={inputCls} />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">项目描述</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="简要描述项目目标和范围" rows={2}
                  className="w-full resize-none rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200" />
              </div>

              {/* 类型（可选预设或自定义）+ 状态 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">项目类型</label>
                  <select value={projectType} onChange={(e) => setProjectType(e.target.value)} className={selectCls}>
                    <option value="">无类型</option>
                    {presetTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                    <option value="__custom__">自定义...</option>
                  </select>
                  {projectType === '__custom__' && (
                    <input type="text" value={customType} onChange={(e) => setCustomType(e.target.value)}
                      placeholder="输入自定义类型" className="mt-1.5 w-full rounded-lg border border-dashed border-indigo-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200" />
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">状态</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
                    {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              {/* 报价 */}
              <div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">报价（元）</label>
                  <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0.00" min="0" step="0.01" className={inputCls} />
                </div>
              </div>

              {/* 日期 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">开始日期</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">截止日期</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
                </div>
              </div>

              {/* 归属客户 */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">归属客户</label>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={selectCls}>
                  <option value="">不关联客户</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.company ? `${c.company}（${c.name}）` : c.name}</option>)}
                </select>
              </div>

              {/* 成本备注 */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">成本备注</label>
                <textarea value={expenseNote} onChange={(e) => setExpenseNote(e.target.value)}
                  placeholder="如：外包、服务器、素材、差旅等成本说明" rows={2}
                  className="w-full resize-none rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200" />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => { reset(); onClose(); }}
                className="h-10 rounded-lg border border-slate-200 px-5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50">取消</button>
              <button type="submit" disabled={isLoading || !name.trim()}
                className="flex h-10 items-center gap-1.5 rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50">
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}{isEdit ? '保存修改' : '创建项目'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
