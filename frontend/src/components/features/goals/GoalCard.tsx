'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Target,
  Calendar,
  MoreVertical,
  Edit3,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  FolderKanban,
  Users,
  BookOpen,
  Percent,
} from 'lucide-react';
import { GoalProgress } from './GoalProgress';
import { ProgressLogList } from './ProgressLogList';
import { useProgressLogs, useAddProgressLog, useDeleteProgressLog } from '@/hooks/useGoals';
import type { Goal, GoalMilestone } from '@/hooks/useGoals';

const typeLabel: Record<string, string> = {
  MONTHLY: '月度',
  QUARTERLY: '季度',
  YEARLY: '年度',
};

const metricLabel: Record<string, string> = {
  REVENUE: '收入',
  PROJECT_COUNT: '项目',
  CLIENT_COUNT: '客户',
  HOURS: '工时',
  PERCENTAGE: '百分比',
  MILESTONE: '里程碑',
};

const metricIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  REVENUE: Target,
  PROJECT_COUNT: FolderKanban,
  CLIENT_COUNT: Users,
  HOURS: Target,
  PERCENTAGE: Percent,
  MILESTONE: CheckCircle2,
};

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE: { label: '进行中', color: 'text-blue-600', bg: 'bg-blue-50' },
  COMPLETED: { label: '已完成', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ABANDONED: { label: '已放弃', color: 'text-slate-500', bg: 'bg-slate-100' },
  AT_RISK: { label: '进度落后', color: 'text-red-600', bg: 'bg-red-50' },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function daysLeft(endDate: string): number {
  const end = new Date(endDate);
  const now = new Date();
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

interface GoalCardProps {
  goal: Goal;
  onEdit?: (goal: Goal) => void;
  onDelete?: (id: string) => void;
  onCalculate?: (id: string) => void;
  onToggleMilestone?: (goalId: string, milestoneId: string, completed: boolean) => void;
}

export function GoalCard({ goal, onEdit, onDelete, onCalculate, onToggleMilestone }: GoalCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showMilestones, setShowMilestones] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: logs, isLoading: logsLoading } = useProgressLogs(goal.id, showLogs);
  const addLogMutation = useAddProgressLog(goal.id);
  const deleteLogMutation = useDeleteProgressLog(goal.id);

  const status = statusConfig[goal.status] || statusConfig.ACTIVE;
  const remaining = daysLeft(goal.endDate);
  const isComplete = goal.status === 'COMPLETED';
  const isAtRisk = goal.status === 'AT_RISK';
  const milestones = goal.milestones || [];
  const doneMilestones = milestones.filter((m) => m.completed).length;
  const isMilestoneType = goal.metricType === 'MILESTONE';
  const MetricIcon = metricIcon[goal.metricType] || Target;

  // 计算进度百分比
  const progressPercent = isMilestoneType
    ? (milestones.length > 0 ? Math.round((doneMilestones / milestones.length) * 100) : 0)
    : goal.targetValue
      ? Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100))
      : 0;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div
      className={cn(
        'group rounded-xl border border-slate-200/60 bg-white shadow-sm transition-all hover:shadow-md',
        isComplete && 'opacity-75',
      )}
    >
      {/* 主内容区 */}
      <div className="p-5">
        {/* 顶部：标题 + 状态 + 操作 */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className={cn(
                  'text-sm font-semibold',
                  isComplete ? 'text-slate-400 line-through' : 'text-slate-800',
                )}
              >
                {goal.title}
              </h3>
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', status.bg, status.color)}>
                {status.label}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <MetricIcon className="h-3 w-3" />
                {metricLabel[goal.metricType] || '自定义'} · {typeLabel[goal.type]}
              </span>
              <span className="h-0.5 w-0.5 rounded-full bg-slate-300" />
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(goal.startDate)} - {formatDate(goal.endDate)}
              </span>
              {!isComplete && (
                <>
                  <span className="h-0.5 w-0.5 rounded-full bg-slate-300" />
                  <span className={cn('font-medium', remaining <= 3 ? 'text-red-500' : 'text-slate-400')}>
                    剩余 {remaining} 天
                  </span>
                </>
              )}
            </div>
          </div>

          {/* 操作菜单 */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="rounded-md p-1.5 text-slate-300 opacity-0 transition-all hover:bg-slate-100 hover:text-slate-500 group-hover:opacity-100"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                {goal.progressMode === 'AUTO' && onCalculate && (
                  <button
                    onClick={() => { onCalculate(goal.id); setShowMenu(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-slate-600 hover:bg-slate-50"
                  >
                    <RefreshCw className="h-3 w-3" />自动计算进度
                  </button>
                )}
                <button
                  onClick={() => { onEdit?.(goal); setShowMenu(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-slate-600 hover:bg-slate-50"
                >
                  <Edit3 className="h-3 w-3" />编辑
                </button>
                <button
                  onClick={() => { onDelete?.(goal.id); setShowMenu(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" />删除
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 描述 */}
        {goal.description && (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-400">
            {goal.description}
          </p>
        )}

        {/* 关联信息 */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {goal.project && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <FolderKanban className="h-3 w-3" />
              <span>项目：{goal.project.name}</span>
            </div>
          )}
          {goal.customer && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Users className="h-3 w-3" />
              <span>客户：{goal.customer.name}{goal.customer.company ? ` (${goal.customer.company})` : ''}</span>
            </div>
          )}
        </div>

        {/* 进度条 */}
        {isMilestoneType ? (
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-mono font-semibold text-slate-700">
                {doneMilestones}/{milestones.length} 里程碑
              </span>
              <span className={cn('font-mono font-semibold', isComplete ? 'text-emerald-600' : 'text-indigo-600')}>
                {progressPercent}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn('h-full rounded-full transition-all duration-500', isComplete ? 'bg-emerald-500' : 'bg-indigo-500')}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        ) : goal.targetValue ? (
          <div className="mt-3">
            <GoalProgress
              current={goal.currentValue}
              target={goal.targetValue}
              unit={goal.unit || undefined}
            />
          </div>
        ) : null}

        {/* 预警提示 */}
        {isAtRisk && (
          <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-600">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>进度落后，需加速推进</span>
          </div>
        )}
      </div>

      {/* 里程碑区域（MILESTONE 类型） */}
      {isMilestoneType && milestones.length > 0 && (
        <div className="border-t border-slate-100">
          <button
            onClick={() => setShowMilestones(!showMilestones)}
            className="flex w-full items-center gap-2 px-5 py-2.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50"
          >
            {showMilestones ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            里程碑 {doneMilestones}/{milestones.length}
            <div className="ml-auto flex items-center gap-1">
              {milestones.map((m) => (
                <div
                  key={m.id}
                  className={cn('h-1.5 w-4 rounded-full', m.completed ? 'bg-emerald-400' : 'bg-slate-200')}
                />
              ))}
            </div>
          </button>
          {showMilestones && (
            <div className="border-t border-slate-50 px-5 py-2">
              {milestones.map((m) => (
                <MilestoneItem
                  key={m.id}
                  milestone={m}
                  onToggle={(completed) => onToggleMilestone?.(goal.id, m.id, completed)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 进度日记区域（非 MILESTONE 类型） */}
      {!isMilestoneType && (
        <div className="border-t border-slate-100">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="flex w-full items-center gap-2 px-5 py-2.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50"
          >
            {showLogs ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <BookOpen className="h-3 w-3" />
            进度记录 ({logs?.length || 0})
            {goal.project && (
              <span className="ml-auto text-[10px] text-slate-400">自动同步 + 手动记录</span>
            )}
          </button>
          {showLogs && (
            <div className="border-t border-slate-50 px-5 py-2">
              {goal.project && (
                <div className="mb-2 rounded-lg bg-blue-50 px-3 py-2 text-[11px] text-blue-600">
                  💡 已关联项目「{goal.project.name}」，可点击菜单中的「自动计算进度」同步数据
                </div>
              )}
              {goal.customer && (
                <div className="mb-2 rounded-lg bg-purple-50 px-3 py-2 text-[11px] text-purple-600">
                  💡 已关联客户「{goal.customer.name}」，自动计算将统计该客户下所有项目
                </div>
              )}
              <ProgressLogList
                goalId={goal.id}
                unit={goal.unit || undefined}
                logs={logs || []}
                isLoading={logsLoading}
                onAdd={(data) => addLogMutation.mutate(data)}
                onDelete={(logId) => deleteLogMutation.mutate(logId)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ======================== 里程碑单项 ========================

function MilestoneItem({
  milestone,
  onToggle,
}: {
  milestone: GoalMilestone;
  onToggle: (completed: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2.5 py-1.5 cursor-pointer group">
      <button
        onClick={() => onToggle(!milestone.completed)}
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all',
          milestone.completed
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : 'border-slate-300 hover:border-indigo-400',
        )}
      >
        {milestone.completed && <CheckCircle2 className="h-3 w-3" />}
      </button>
      <span
        className={cn(
          'flex-1 text-xs',
          milestone.completed ? 'text-slate-400 line-through' : 'text-slate-600',
        )}
      >
        {milestone.title}
      </span>
    </label>
  );
}
