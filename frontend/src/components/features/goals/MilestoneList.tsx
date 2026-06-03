'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Plus, Trash2, CheckCircle2, Loader2 } from 'lucide-react';
import type { GoalMilestone } from '@/hooks/useGoals';

interface MilestoneListProps {
  goalId: string;
  milestones: GoalMilestone[];
  unit?: string;
  isLoading?: boolean;
  onToggle: (milestoneId: string, completed: boolean) => void;
  onAdd: (data: { title: string; targetValue: number }) => void;
  onDelete: (milestoneId: string) => void;
}

export function MilestoneList({
  milestones,
  unit,
  isLoading,
  onToggle,
  onAdd,
  onDelete,
}: MilestoneListProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newValue, setNewValue] = useState('');

  function handleAdd() {
    if (!newTitle.trim() || !newValue) return;
    onAdd({ title: newTitle.trim(), targetValue: Number(newValue) });
    setNewTitle('');
    setNewValue('');
    setShowAdd(false);
  }

  const doneCount = milestones.filter((m) => m.completed).length;

  return (
    <div className="space-y-2">
      {/* 标题行 */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          里程碑 {doneCount}/{milestones.length}
        </span>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-indigo-600 hover:bg-indigo-50"
        >
          <Plus className="h-3 w-3" />
          添加
        </button>
      </div>

      {/* 添加表单 */}
      {showAdd && (
        <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/50 p-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="里程碑标题"
            className="flex-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs outline-none focus:border-indigo-300"
          />
          <input
            type="number"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="目标值"
            min="0"
            className="w-20 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs outline-none focus:border-indigo-300"
          />
          <button
            onClick={handleAdd}
            disabled={!newTitle.trim() || !newValue}
            className="rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            添加
          </button>
          <button
            onClick={() => setShowAdd(false)}
            className="rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            取消
          </button>
        </div>
      )}

      {/* 里程碑列表 */}
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : milestones.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted-foreground">暂无里程碑</p>
      ) : (
        <div className="space-y-1">
          {milestones.map((m) => (
            <div
              key={m.id}
              className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted"
            >
              <button
                onClick={() => onToggle(m.id, !m.completed)}
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                  m.completed
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-border hover:border-indigo-400',
                )}
              >
                {m.completed && <CheckCircle2 className="h-3 w-3" />}
              </button>
              <span
                className={cn(
                  'flex-1 text-xs',
                  m.completed ? 'text-muted-foreground line-through' : 'text-foreground/70',
                )}
              >
                {m.title}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {formatValue(m.targetValue, unit)}
              </span>
              <button
                onClick={() => onDelete(m.id)}
                className="rounded p-1 text-muted-foreground/50 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatValue(value: number, unit?: string): string {
  if (unit === '元') {
    return `¥${value >= 10000 ? `${(value / 10000).toFixed(1)}万` : value.toLocaleString()}`;
  }
  return `${value}${unit || ''}`;
}
