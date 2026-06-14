'use client';

import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useCustomerList } from '@/hooks/useCustomers';
import type { CreateProjectInput, Project } from '@/hooks/useProjects';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';

const statusOptions = [
  { value: 'ACTIVE', label: '进行中' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'ARCHIVED', label: '已归档' },
];

const presetTypes = ['开发', '设计', '运营', '咨询', '维护', '其他'];

const inputCls = 'w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60';
const labelCls = 'mb-1.5 block text-sm font-medium text-foreground/80';

interface ProjectFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateProjectInput) => void;
  isLoading?: boolean;
  editProject?: Project | null;
}

export function ProjectForm({
  open, onClose, onSubmit, isLoading, editProject,
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

  useEffect(() => {
    if (!open) return;
    if (editProject) {
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
        setProjectType(editProject.type); setCustomType('');
      } else if (editProject.type) {
        setProjectType('__custom__'); setCustomType(editProject.type);
      } else {
        setProjectType(''); setCustomType('');
      }
    } else {
      reset();
    }
  }, [open]);

  function reset() {
    setName(''); setDescription(''); setStatus('ACTIVE'); setQuote('');
    setStartDate(''); setEndDate(''); setCustomerId('');
    setProjectType(''); setCustomType(''); setExpenseNote(''); setRewardNote('');
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

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="flex flex-col max-h-[90vh] p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{isEdit ? '编辑订单' : '新建订单'}</DialogTitle>
          <DialogDescription>{isEdit ? '修改订单信息后将实时更新' : '填写订单信息后创建'}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-4">
              <div>
                <label className={labelCls}>订单名称 <span className="text-red-500">*</span></label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="输入订单名称" required className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>订单说明</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="补充交付范围、关键约束和验收说明" rows={3}
                  className="w-full resize-none rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>订单类型</label>
                  <Select value={projectType} onValueChange={(v) => setProjectType(v || "")}>
                    <SelectTrigger className={cn(inputCls, "w-full")}>
                      <SelectValue placeholder="未分类" />
                    </SelectTrigger>
                    <SelectContent>
                      {presetTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      <SelectItem value="__custom__">自定义...</SelectItem>
                    </SelectContent>
                  </Select>
                  {projectType === '__custom__' && (
                    <input type="text" value={customType} onChange={(e) => setCustomType(e.target.value)} placeholder="输入自定义类型"
                      className="mt-1.5 w-full rounded-lg border border-dashed border-indigo-300 px-3 py-2 text-sm text-foreground/80 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200" />
                  )}
                </div>
                <div>
                  <label className={labelCls}>状态</label>
                  <Select value={status} onValueChange={(v) => setStatus(v || "ACTIVE")}>
                    <SelectTrigger className={cn(inputCls, "w-full")}>
                      <SelectValue placeholder="选择状态" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>报价（元）</label>
                  <input type="number" value={quote} onChange={(e) => setQuote(e.target.value)} placeholder="0.00" min="0" step="0.01" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>关联客户</label>
                  <Select value={customerId} onValueChange={(v) => setCustomerId(v || "")}>
                    <SelectTrigger className={cn(inputCls, "w-full")}>
                      <SelectValue placeholder="不关联客户" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.company ? `${c.company}（${c.name}）` : c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>开始日期</label>
                  <DatePicker value={startDate} onChange={setStartDate} />
                </div>
                <div>
                  <label className={labelCls}>截止日期</label>
                  <DatePicker value={endDate} onChange={setEndDate} />
                </div>
              </div>

              <div>
                <label className={labelCls}>成本备注</label>
                <textarea value={expenseNote} onChange={(e) => setExpenseNote(e.target.value)} placeholder="记录外包、材料、差旅、服务器等成本背景" rows={2}
                  className="w-full resize-none rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60" />
              </div>

              <div>
                <label className={labelCls}>报价说明</label>
                <textarea value={rewardNote} onChange={(e) => setRewardNote(e.target.value)} placeholder="记录合同金额结构、付款节点或补充约定" rows={2}
                  className="w-full resize-none rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
            <button type="button" onClick={() => { reset(); onClose(); }}
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted">取消</button>
            <button type="submit" disabled={isLoading || !name.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? '保存修改' : '创建订单'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
