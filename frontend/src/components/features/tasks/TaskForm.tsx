'use client';
import { cn } from '@/lib/utils';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import type { Task, CreateTaskInput } from '@/hooks/useTasks';
import type { Project } from '@/hooks/useProjects';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';

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

export function TaskForm({
  open, onClose, onSubmit, isLoading, editTask,
  projects = [], defaultProjectId, projectId: projectIdProp,
}: TaskFormProps) {
  const isEdit = !!editTask;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('TODO');
  const [priority, setPriority] = useState('MEDIUM');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [actualHours, setActualHours] = useState('');
  const [cost, setCost] = useState('');
  const [costNote, setCostNote] = useState('');
  const [blockedReason, setBlockedReason] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [projectId, setProjectId] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editTask) {
      setTitle(editTask.title);
      setDescription(editTask.description || '');
      setStatus(editTask.status);
      setPriority(editTask.priority);
      setEstimatedHours(editTask.estimatedHours ? String(editTask.estimatedHours) : '');
      setActualHours(editTask.actualHours ? String(editTask.actualHours) : '');
      setCost(editTask.cost ? String(editTask.cost / 100) : '');
      setCostNote(editTask.costNote || '');
      setBlockedReason(editTask.blockedReason || '');
      setDueDate(editTask.dueDate ? safeDateValue(editTask.dueDate) : '');
      setProjectId(editTask.projectId);
    } else {
      reset();
      const pid = projectIdProp || defaultProjectId;
      if (pid) setProjectId(pid);
    }
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !projectId) return;
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      status, priority,
      estimatedHours: estimatedHours ? Number(estimatedHours) : undefined,
      actualHours: actualHours ? Number(actualHours) : undefined,
      cost: cost ? Math.round(Number(cost) * 100) : undefined,
      costNote: costNote.trim() || undefined,
      blockedReason: status === 'BLOCKED' ? (blockedReason.trim() || undefined) : undefined,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      projectId,
    });
  }

  function reset() {
    setTitle(''); setDescription(''); setStatus('TODO'); setPriority('MEDIUM');
    setEstimatedHours(''); setActualHours(''); setCost(''); setCostNote('');
    setBlockedReason(''); setDueDate(''); setProjectId('');
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="flex flex-col max-h-[90vh] p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{isEdit ? '编辑任务' : '新建任务'}</DialogTitle>
          <DialogDescription>{isEdit ? '修改任务信息后将实时更新' : '填写任务信息后创建'}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-4">
              <div>
                <label className={labelCls}>任务标题 <span className="text-red-500">*</span></label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="输入任务标题" className={inputCls} required />
              </div>

              <div>
                <label className={labelCls}>任务描述</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="简要描述任务内容" rows={3}
                  className="w-full resize-none rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60" />
              </div>

              {projects.length > 0 && !defaultProjectId && (
                <div>
                  <label className={labelCls}>所属项目 <span className="text-red-500">*</span></label>
                  <Select value={projectId} onValueChange={(v) => setProjectId(v || "")} required>
                    <SelectTrigger className={cn(inputCls, "w-full")}><SelectValue placeholder="选择项目" /></SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>状态</label>
                  <Select value={status} onValueChange={(v) => setStatus(v || "TODO")}>
                    <SelectTrigger className={cn(inputCls, "w-full")}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={labelCls}>优先级</label>
                  <Select value={priority} onValueChange={(v) => setPriority(v || "MEDIUM")}>
                    <SelectTrigger className={cn(inputCls, "w-full")}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {priorityOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>预估工时（小时）</label>
                  <input type="number" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} placeholder="0" min="0" step="0.5" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>实际工时（小时）</label>
                  <input type="number" value={actualHours} onChange={(e) => setActualHours(e.target.value)} placeholder="完成后填写" min="0" step="0.5" className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>花销（元）</label>
                  <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" min="0" step="0.01" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>花销说明</label>
                  <input type="text" value={costNote} onChange={(e) => setCostNote(e.target.value)} placeholder="如：购买域名" className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>截止日期</label>
                <DatePicker value={dueDate} onChange={setDueDate} />
              </div>

              {status === 'BLOCKED' && (
                <div>
                  <label className={labelCls}>阻塞原因 <span className="text-red-500">*</span></label>
                  <input type="text" value={blockedReason} onChange={(e) => setBlockedReason(e.target.value)} placeholder="说明为什么被阻塞"
                    className="w-full rounded-lg border border-red-200 px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-red-300 focus:ring-1 focus:ring-red-200" />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
            <button type="button" onClick={() => { reset(); onClose(); }}
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted">取消</button>
            <button type="submit" disabled={isLoading || !title.trim() || !projectId}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? '保存修改' : '创建任务'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
