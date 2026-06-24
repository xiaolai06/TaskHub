'use client';
import { cn } from '@/lib/utils';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import type { Task, CreateTaskInput } from '@/hooks/useTasks';
import type { Project } from '@/hooks/useProjects';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';

// ─── Zod Schema ───────────────────────────────────────────

// Schema uses z.number() for typed fields. We apply valueAsNumber in register()
// so HTML input values are coerced to numbers before reaching Zod.
const taskFormSchema = z.object({
  title: z.string().min(1, '任务标题不能为空').max(200, '标题不超过200字'),
  description: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED']),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW']),
  estimatedHours: z.number().min(0, '工时不能为负').optional().nullable(),
  actualHours: z.number().min(0, '工时不能为负').optional().nullable(),
  cost: z.number().min(0, '成本不能为负').optional().nullable(),
  costNote: z.string().optional(),
  blockedReason: z.string().optional(),
  dueDate: z.string().optional(),
  startDate: z.string().optional(),
  projectId: z.string().min(1, '请选择所属项目'),
  assigneeId: z.string().optional(),
  parentId: z.string().optional(),
}).refine(
  (data) => data.status !== 'BLOCKED' || (data.blockedReason && data.blockedReason.trim().length > 0),
  { message: '阻塞任务必须填写阻塞原因', path: ['blockedReason'] }
);

type TaskFormValues = z.infer<typeof taskFormSchema>;

// ─── Helpers & Constants ──────────────────────────────────

function safeDateValue(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

const statusOptions = [
  { value: 'TODO', label: '待办' },
  { value: 'IN_PROGRESS', label: '进行中' },
  { value: 'DONE', label: '已完成' },
  { value: 'BLOCKED', label: '阻塞' },
];

const priorityOptions = [
  { value: 'URGENT', label: '紧急' },
  { value: 'HIGH', label: '高' },
  { value: 'MEDIUM', label: '中' },
  { value: 'LOW', label: '低' },
];

const inputCls = 'w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60';
const labelCls = 'mb-1.5 block text-sm font-medium text-foreground/80';

// ─── TaskFormContent ──────────────────────────────────────

interface TaskFormContentProps {
  onSubmit: (data: CreateTaskInput) => void;
  onCancel: () => void;
  isLoading?: boolean;
  editTask?: Task | null;
  projects?: Project[];
  defaultProjectId?: string;
  projectId?: string;
}

/**
 * 表单内容（不包含 Dialog 包裹），可嵌入 LeftSidePanel 或其他容器。
 */
export function TaskFormContent({
  onSubmit, onCancel, isLoading, editTask,
  projects = [], defaultProjectId, projectId: projectIdProp,
}: TaskFormContentProps) {
  const isEdit = !!editTask;

  const {
    register, control, handleSubmit, watch, reset,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: '',
      description: '',
      status: 'TODO',
      priority: 'MEDIUM',
      estimatedHours: undefined,
      actualHours: undefined,
      cost: undefined,
      costNote: '',
      blockedReason: '',
      dueDate: '',
      startDate: '',
      projectId: '',
    },
  });

  const watchedStatus = watch('status');

  useEffect(() => {
    if (editTask) {
      reset({
        title: editTask.title,
        description: editTask.description || '',
        status: editTask.status as TaskFormValues['status'],
        priority: editTask.priority as TaskFormValues['priority'],
        estimatedHours: editTask.estimatedHours ?? undefined,
        actualHours: editTask.actualHours ?? undefined,
        cost: editTask.cost ? editTask.cost / 100 : undefined,
        costNote: editTask.costNote || '',
        blockedReason: editTask.blockedReason || '',
        dueDate: editTask.dueDate ? safeDateValue(editTask.dueDate) : '',
        startDate: editTask.startDate ? safeDateValue(editTask.startDate) : '',
        projectId: editTask.projectId,
      });
    } else {
      const pid = projectIdProp || defaultProjectId;
      reset({
        title: '',
        description: '',
        status: 'TODO',
        priority: 'MEDIUM',
        estimatedHours: undefined,
        actualHours: undefined,
        cost: undefined,
        costNote: '',
        blockedReason: '',
        dueDate: '',
        startDate: '',
        projectId: pid || '',
      });
    }
  }, [editTask?.id, projectIdProp, defaultProjectId, reset]);

  function onFormSubmit(values: TaskFormValues) {
    onSubmit({
      title: values.title.trim(),
      description: values.description?.trim() || undefined,
      status: values.status,
      priority: values.priority,
      estimatedHours: values.estimatedHours ?? undefined,
      actualHours: values.actualHours ?? undefined,
      cost: values.cost ? Math.round(values.cost * 100) : undefined,
      costNote: values.costNote?.trim() || undefined,
      blockedReason: values.status === 'BLOCKED' ? (values.blockedReason?.trim() || undefined) : undefined,
      dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : undefined,
      startDate: values.startDate ? new Date(values.startDate).toISOString() : undefined,
      projectId: values.projectId,
    });
  }

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>任务标题 <span className="text-red-500">*</span></label>
            <input type="text" {...register('title')} placeholder="输入任务标题" className={inputCls} />
            {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <label className={labelCls}>任务描述</label>
            <textarea {...register('description')} placeholder="简要描述任务内容" rows={3}
              className="w-full resize-none rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60" />
          </div>

          {projects.length > 0 && !defaultProjectId && (
            <div>
              <label className={labelCls}>所属项目 <span className="text-red-500">*</span></label>
              <Controller name="projectId" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className={cn(inputCls, "w-full")}><SelectValue placeholder="选择项目" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
              {errors.projectId && <p className="text-sm text-destructive mt-1">{errors.projectId.message}</p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>状态</label>
              <Controller name="status" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className={cn(inputCls, "w-full")}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div>
              <label className={labelCls}>优先级</label>
              <Controller name="priority" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className={cn(inputCls, "w-full")}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>预估工时（小时）</label>
              <input type="number" {...register('estimatedHours', { valueAsNumber: true })} placeholder="0" min="0" step="0.5" className={inputCls} />
              {errors.estimatedHours && <p className="text-sm text-destructive mt-1">{errors.estimatedHours.message}</p>}
            </div>
            <div>
              <label className={labelCls}>实际工时（小时）</label>
              <input type="number" {...register('actualHours', { valueAsNumber: true })} placeholder="完成后填写" min="0" step="0.5" className={inputCls} />
              {errors.actualHours && <p className="text-sm text-destructive mt-1">{errors.actualHours.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>花销（元）</label>
              <input type="number" {...register('cost', { valueAsNumber: true })} placeholder="0.00" min="0" step="0.01" className={inputCls} />
              {errors.cost && <p className="text-sm text-destructive mt-1">{errors.cost.message}</p>}
            </div>
            <div>
              <label className={labelCls}>花销说明</label>
              <input type="text" {...register('costNote')} placeholder="如：购买域名" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>截止日期</label>
            <Controller name="dueDate" control={control} render={({ field }) => (
              <DatePicker value={field.value} onChange={field.onChange} />
            )} />
          </div>

          {watchedStatus === 'BLOCKED' && (
            <div>
              <label className={labelCls}>阻塞原因 <span className="text-red-500">*</span></label>
              <input type="text" {...register('blockedReason')} placeholder="说明为什么被阻塞"
                className="w-full rounded-lg border border-red-200 px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-red-300 focus:ring-1 focus:ring-red-200" />
              {errors.blockedReason && <p className="text-sm text-destructive mt-1">{errors.blockedReason.message}</p>}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t px-5 py-3.5">
        <button type="button" onClick={onCancel}
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted">取消</button>
        <button type="submit" disabled={isLoading}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? '保存修改' : '创建任务'}
        </button>
      </div>
    </form>
  );
}

// ─── TaskForm (Dialog wrapper) ────────────────────────────

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateTaskInput) => void;
  isLoading?: boolean;
  editTask?: Task | null;
  projects?: Project[];
  defaultProjectId?: string;
  projectId?: string;
}

/**
 * Dialog 包装版本（向后兼容 SubtaskList / 项目详情页等仍在使用的场景）。
 */
export function TaskForm({
  open, onClose, onSubmit, isLoading, editTask,
  projects, defaultProjectId, projectId,
}: TaskFormProps) {
  const isEdit = !!editTask;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="flex flex-col max-h-[90vh] p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{isEdit ? '编辑任务' : '新建任务'}</DialogTitle>
          <DialogDescription>{isEdit ? '修改任务信息后将实时更新' : '填写任务信息后创建'}</DialogDescription>
        </DialogHeader>
        <TaskFormContent
          onSubmit={onSubmit}
          onCancel={onClose}
          isLoading={isLoading}
          editTask={editTask}
          projects={projects}
          defaultProjectId={defaultProjectId}
          projectId={projectId}
        />
      </DialogContent>
    </Dialog>
  );
}
