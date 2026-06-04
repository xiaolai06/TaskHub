'use client';

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { Task, CreateTaskInput } from '@/hooks/useTasks';
import type { Project } from '@/hooks/useProjects';

/** 安全地将日期字符串转为 YYYY-MM-DD 格式，无效日期返回空字符串 */
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
  open,
  onClose,
  onSubmit,
  isLoading,
  editTask,
  projects = [],
  defaultProjectId,
  projectId: projectIdProp,
}: TaskFormProps) {
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

  const isEdit = !!editTask;

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
      status,
      priority,
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

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card shadow-xl">
          {/* 头部 */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-6 py-4">
            <h2 className="text-base font-semibold text-foreground">{isEdit ? '编辑任务' : '新建任务'}</h2>
            <button onClick={() => { reset(); onClose(); }} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground/70">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="px-6 py-5">
            <div className="space-y-4">
              {/* 任务标题 */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground/80">任务标题 <span className="text-red-500">*</span></label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="输入任务标题"
                  className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none" required />
              </div>

              {/* 描述 */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground/80">任务描述</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="简要描述任务内容" rows={3}
                  className="w-full resize-none rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none" />
              </div>

              {/* 所属项目 */}
              {projects.length > 0 && !defaultProjectId && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground/80">所属项目 <span className="text-red-500">*</span></label>
                  <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
                    className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none" required>
                    <option value="">选择项目</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              {/* 状态 + 优先级 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground/80">状态</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none">
                    {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground/80">优先级</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value)}
                    className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none">
                    {priorityOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              {/* 工时：预估 + 实际 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground/80">预估工时（小时）</label>
                  <input type="number" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} placeholder="0" min="0" step="0.5"
                    className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground/80">实际工时（小时）</label>
                  <input type="number" value={actualHours} onChange={(e) => setActualHours(e.target.value)} placeholder="完成后填写" min="0" step="0.5"
                    className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none" />
                </div>
              </div>

              {/* 花销 + 说明 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground/80">花销（元）</label>
                  <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" min="0" step="0.01"
                    className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground/80">花销说明</label>
                  <input type="text" value={costNote} onChange={(e) => setCostNote(e.target.value)} placeholder="如：购买域名"
                    className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none" />
                </div>
              </div>

              {/* 截止日期 */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground/80">截止日期</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none" />
              </div>

              {/* 阻塞原因（仅 BLOCKED 状态显示） */}
              {status === 'BLOCKED' && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground/80">阻塞原因 <span className="text-red-500">*</span></label>
                  <input type="text" value={blockedReason} onChange={(e) => setBlockedReason(e.target.value)} placeholder="说明为什么被阻塞"
                    className="w-full rounded-lg border border-red-200 px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-red-300 focus:ring-1 focus:ring-red-200" />
                </div>
              )}
            </div>

            {/* 按钮 */}
            <div className="mt-6 flex justify-end gap-2.5">
              <button type="button" onClick={() => { reset(); onClose(); }}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground/70 hover:bg-muted focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none">取消</button>
              <button type="submit" disabled={isLoading || !title.trim() || !projectId}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none">
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEdit ? '保存修改' : '创建任务'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
