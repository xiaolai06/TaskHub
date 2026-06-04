'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  Plus,
  ArrowRight,
  AlertTriangle,
  CalendarDays,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { useInsertionSimulation, type InsertionResult } from '@/hooks/useSchedule';
import { useProjectList } from '@/hooks/useProjects';

// ======================== 常量 ========================

const PRIORITIES = [
  { value: 'URGENT', label: '紧急', color: 'text-red-600' },
  { value: 'HIGH', label: '高', color: 'text-orange-600' },
  { value: 'MEDIUM', label: '中', color: 'text-blue-600' },
  { value: 'LOW', label: '低', color: 'text-foreground/70' },
];

// ======================== 组件 ========================

interface InsertionDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InsertionDialog({ projectId, open, onOpenChange }: InsertionDialogProps) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [result, setResult] = useState<InsertionResult | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState(projectId || '');

  const mutation = useInsertionSimulation();
  const { data: projectList } = useProjectList({ limit: 100, status: 'ACTIVE' });
  const projects = projectList?.data || [];
  const effectivePid = selectedProjectId || projectId;

  const handleSubmit = () => {
    if (!title.trim() || !estimatedHours || !effectivePid) return;

    mutation.mutate(
      {
        projectId: effectivePid,
        newTask: {
          title: title.trim(),
          priority,
          estimatedHours: Number(estimatedHours),
          dueDate: dueDate || undefined,
        },
      },
      {
        onSuccess: (data) => {
          setResult(data);
        },
      },
    );
  };

  const handleClose = () => {
    onOpenChange(false);
    setTitle('');
    setPriority('MEDIUM');
    setEstimatedHours('');
    setDueDate('');
    setResult(null);
  };

  const impact = result?.impact;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : handleClose())}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-indigo-500" />
            插单模拟
          </DialogTitle>
          <DialogDescription>
            模拟新增一个任务，查看对当前排期的影响。不会真正创建任务。
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          /* ====== 表单阶段 ====== */
          <div className="space-y-4 py-2">
            {/* 全部项目模式下显示项目选择器 */}
            {!projectId && projects.length > 0 && (
              <div className="space-y-2">
                <Label>选择项目 *</Label>
                <Select value={selectedProjectId} onValueChange={(v) => setSelectedProjectId(v || '')}>
                  <SelectTrigger><SelectValue placeholder="请选择项目" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="title">任务标题 *</Label>
              <Input
                id="title"
                placeholder="例如：紧急 bug 修复"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>优先级</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v || 'MEDIUM')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        <span className={p.color}>{p.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hours">预估工时（小时）*</Label>
                <Input
                  id="hours"
                  type="number"
                  min="0.5"
                  step="0.5"
                  placeholder="8"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">截止日期（可选）</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
        ) : (
          /* ====== 结果阶段 ====== */
          <div className="space-y-5 py-2">
            {/* 新任务排期 */}
            <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-indigo-700 mb-2">
                <CalendarDays className="h-4 w-4" />
                新任务排期位置
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="font-medium text-foreground/80">{title}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-indigo-600 font-mono">
                  {impact?.newTaskScheduled.scheduledStart}
                </span>
                <span className="text-muted-foreground">~</span>
                <span className="text-indigo-600 font-mono">
                  {impact?.newTaskScheduled.scheduledEnd}
                </span>
              </div>
            </div>

            {/* 项目完成日期变化 */}
            <div
              className={`rounded-lg border p-4 ${
                (impact?.projectEndDateChange.delayDays ?? 0) > 0
                  ? 'bg-red-50 border-red-200'
                  : 'bg-green-50 border-green-200'
              }`}
            >
              <div
                className={`flex items-center gap-2 text-sm font-medium mb-2 ${
                  (impact?.projectEndDateChange.delayDays ?? 0) > 0
                    ? 'text-red-700'
                    : 'text-green-700'
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                项目完成日期
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground font-mono">
                  {impact?.projectEndDateChange.original ?? '未设定'}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span
                  className={`font-mono font-medium ${
                    (impact?.projectEndDateChange.delayDays ?? 0) > 0
                      ? 'text-red-600'
                      : 'text-green-600'
                  }`}
                >
                  {impact?.projectEndDateChange.new ?? '未设定'}
                </span>
                {(impact?.projectEndDateChange.delayDays ?? 0) > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    +{impact?.projectEndDateChange.delayDays} 天
                  </Badge>
                )}
                {(impact?.projectEndDateChange.delayDays ?? 0) === 0 && (
                  <Badge className="bg-green-100 text-green-700 text-xs border-green-300">
                    无影响
                  </Badge>
                )}
              </div>
            </div>

            {/* 受影响的任务 */}
            {(impact?.affectedTasks.length ?? 0) > 0 && (
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-foreground/80 mb-3">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  被延期的任务（{impact?.affectedTasks.length} 个）
                </div>
                <div className="space-y-2">
                  {impact?.affectedTasks.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm"
                    >
                      <span className="text-foreground/80 truncate mr-3">
                        {t.title}
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-muted-foreground font-mono text-xs">
                          {t.originalEnd}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                        <span className="text-red-600 font-mono text-xs font-medium">
                          {t.newEnd}
                        </span>
                        <Badge variant="outline" className="text-[10px] text-red-500 border-red-300">
                          +{t.delayDays}d
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 无影响 */}
            {(impact?.affectedTasks.length ?? 0) === 0 &&
              (impact?.projectEndDateChange.delayDays ?? 0) === 0 && (
                <div className="text-center py-6 text-green-600">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-60" />
                  <p className="text-sm font-medium">
                    插入此任务不会影响现有排期
                  </p>
                </div>
              )}

            <Separator />

            {/* 对比摘要 */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-muted-foreground mb-1">原计划</p>
                <p className="font-mono text-foreground/80">
                  {result.originalSchedule.summary.totalTasks} 个任务 ·{' '}
                  {result.originalSchedule.summary.totalHours}h
                </p>
                <p className="font-mono text-muted-foreground">
                  {result.originalSchedule.summary.projectStart ?? '-'} ~{' '}
                  {result.originalSchedule.summary.projectEnd ?? '-'}
                </p>
              </div>
              <div className="rounded-lg bg-indigo-50 p-3">
                <p className="text-indigo-500 mb-1">新计划</p>
                <p className="font-mono text-indigo-700">
                  {result.newSchedule.summary.totalTasks} 个任务 ·{' '}
                  {result.newSchedule.summary.totalHours}h
                </p>
                <p className="font-mono text-indigo-500">
                  {result.newSchedule.summary.projectStart ?? '-'} ~{' '}
                  {result.newSchedule.summary.projectEnd ?? '-'}
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                取消
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!title.trim() || !estimatedHours || !effectivePid || mutation.isPending}
              >
                {mutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                模拟排期
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={handleClose}>
              关闭
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
