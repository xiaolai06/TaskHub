'use client';

import { cn } from '@/lib/utils';
import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { useCustomerList } from '@/hooks/useCustomers';
import type { CreateProjectInput, Project } from '@/hooks/useProjects';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';

// ─── Zod Schema ───────────────────────────────────────────

const projectFormSchema = z.object({
  name: z.string().min(1, '订单名称不能为空').max(200, '名称不超过200字'),
  description: z.string().optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED']),
  type: z.string().optional(),
  customType: z.string().optional(),
  budget: z.number().min(0, '报价不能为负').optional().nullable(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  customerId: z.string().optional(),
  expenseNote: z.string().optional(),
  rewardNote: z.string().optional(),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

// ─── Constants ────────────────────────────────────────────

const statusOptions = [
  { value: 'ACTIVE', label: '进行中' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'ARCHIVED', label: '已归档' },
];

const presetTypes = ['开发', '设计', '运营', '咨询', '维护', '其他'];

const inputCls = 'w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60';
const labelCls = 'mb-1.5 block text-sm font-medium text-foreground/80';

// ─── ProjectFormContent ───────────────────────────────────

interface ProjectFormContentProps {
  onSubmit: (data: CreateProjectInput) => void;
  onCancel: () => void;
  isLoading?: boolean;
  editProject?: Project | null;
}

/**
 * 表单内容（可嵌入 LeftSidePanel 或 Dialog）
 */
export function ProjectFormContent({
  onSubmit, onCancel, isLoading, editProject,
}: ProjectFormContentProps) {
  const { data: customersData } = useCustomerList();
  const customers = customersData?.data || [];

  const isEdit = !!editProject;

  const {
    register, control, handleSubmit, watch, reset,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: '',
      description: '',
      status: 'ACTIVE',
      type: '',
      customType: '',
      budget: undefined,
      startDate: '',
      endDate: '',
      customerId: '',
      expenseNote: '',
      rewardNote: '',
    },
  });

  const watchedType = watch('type');

  useEffect(() => {
    if (editProject) {
      let projectType = '';
      let customTypeVal = '';
      if (editProject.type && presetTypes.includes(editProject.type)) {
        projectType = editProject.type;
      } else if (editProject.type) {
        projectType = '__custom__';
        customTypeVal = editProject.type;
      }
      reset({
        name: editProject.name,
        description: editProject.description || '',
        status: editProject.status as ProjectFormValues['status'],
        type: projectType,
        customType: customTypeVal,
        budget: editProject.budget ? editProject.budget / 100 : undefined,
        startDate: editProject.startDate ? editProject.startDate.split('T')[0] : '',
        endDate: editProject.endDate ? editProject.endDate.split('T')[0] : '',
        customerId: editProject.customerId || '',
        expenseNote: editProject.expenseNote || '',
        rewardNote: editProject.rewardNote || '',
      });
    } else {
      reset({
        name: '',
        description: '',
        status: 'ACTIVE',
        type: '',
        customType: '',
        budget: undefined,
        startDate: '',
        endDate: '',
        customerId: '',
        expenseNote: '',
        rewardNote: '',
      });
    }
  }, [editProject?.id, reset]);

  function onFormSubmit(values: ProjectFormValues) {
    const finalType = values.type === '__custom__' ? values.customType?.trim() : values.type;
    onSubmit({
      name: values.name.trim(),
      description: values.description?.trim() || undefined,
      status: values.status,
      type: finalType || undefined,
      budget: values.budget ? Math.round(values.budget * 100) : undefined,
      startDate: values.startDate || undefined,
      endDate: values.endDate || undefined,
      customerId: values.customerId || undefined,
      expenseNote: values.expenseNote?.trim() || undefined,
      rewardNote: values.rewardNote?.trim() || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>订单名称 <span className="text-red-500">*</span></label>
            <input type="text" {...register('name')} placeholder="输入订单名称" className={inputCls} />
            {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className={labelCls}>订单说明</label>
            <textarea {...register('description')} placeholder="补充交付范围、关键约束和验收说明" rows={3}
              className="w-full resize-none rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>订单类型</label>
              <Controller name="type" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className={cn(inputCls, "w-full")}>
                    <SelectValue placeholder="未分类" />
                  </SelectTrigger>
                  <SelectContent>
                    {presetTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    <SelectItem value="__custom__">自定义...</SelectItem>
                  </SelectContent>
                </Select>
              )} />
              {watchedType === '__custom__' && (
                <input type="text" {...register('customType')} placeholder="输入自定义类型"
                  className="mt-1.5 w-full rounded-lg border border-dashed border-indigo-300 px-3 py-2 text-sm text-foreground/80 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200" />
              )}
            </div>
            <div>
              <label className={labelCls}>状态</label>
              <Controller name="status" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className={cn(inputCls, "w-full")}>
                    <SelectValue placeholder="选择状态" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>报价（元）</label>
              <input type="number" {...register('budget', { valueAsNumber: true })} placeholder="0.00" min="0" step="0.01" className={inputCls} />
              {errors.budget && <p className="text-sm text-destructive mt-1">{errors.budget.message}</p>}
            </div>
            <div>
              <label className={labelCls}>关联客户</label>
              <Controller name="customerId" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className={cn(inputCls, "w-full")}>
                    <SelectValue placeholder="不关联客户" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.company ? `${c.company}（${c.name}）` : c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>开始日期</label>
              <Controller name="startDate" control={control} render={({ field }) => (
                <DatePicker value={field.value} onChange={field.onChange} />
              )} />
            </div>
            <div>
              <label className={labelCls}>截止日期</label>
              <Controller name="endDate" control={control} render={({ field }) => (
                <DatePicker value={field.value} onChange={field.onChange} />
              )} />
            </div>
          </div>

          <div>
            <label className={labelCls}>成本备注</label>
            <textarea {...register('expenseNote')} placeholder="记录外包、材料、差旅、服务器等成本背景" rows={2}
              className="w-full resize-none rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60" />
          </div>

          <div>
            <label className={labelCls}>报价说明</label>
            <textarea {...register('rewardNote')} placeholder="记录合同金额结构、付款节点或补充约定" rows={2}
              className="w-full resize-none rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t px-5 py-3.5">
        <button type="button" onClick={onCancel}
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted">取消</button>
        <button type="submit" disabled={isLoading}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? '保存修改' : '创建订单'}
        </button>
      </div>
    </form>
  );
}

// ─── ProjectForm (Dialog wrapper) ─────────────────────────

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
  const isEdit = !!editProject;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="flex flex-col max-h-[90vh] p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{isEdit ? '编辑订单' : '新建订单'}</DialogTitle>
          <DialogDescription>{isEdit ? '修改订单信息后将实时更新' : '填写订单信息后创建'}</DialogDescription>
        </DialogHeader>
        <ProjectFormContent
          onSubmit={onSubmit}
          onCancel={onClose}
          isLoading={isLoading}
          editProject={editProject}
        />
      </DialogContent>
    </Dialog>
  );
}
