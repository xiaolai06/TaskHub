'use client';

import { useState } from 'react';
import { Plus, Trash2, Loader2, Calendar, MessageSquare } from 'lucide-react';
import type { GoalProgressLog } from '@/hooks/useGoals';

interface ProgressLogListProps {
  goalId: string;
  unit?: string;
  logs: GoalProgressLog[];
  isLoading?: boolean;
  onAdd: (data: { value: number; note?: string }) => void;
  onDelete: (logId: string) => void;
}

export function ProgressLogList({ unit, logs, isLoading, onAdd, onDelete }: ProgressLogListProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [newNote, setNewNote] = useState('');

  function handleAdd() {
    if (!newValue || Number(newValue) <= 0) return;
    onAdd({
      value: Number(newValue),
      note: newNote.trim() || undefined,
    });
    setNewValue('');
    setNewNote('');
    setShowAdd(false);
  }

  // 根据单位类型生成提示
  const unitHint = unit === '元' ? '金额（元）' : unit === '个' ? '数量' : unit === '小时' ? '工时（小时）' : '进度值';
  const unitPlaceholder = unit === '元' ? '如：5000' : unit === '个' ? '如：1' : unit === '小时' ? '如：4' : '输入数值';

  return (
    <div className="space-y-2">
      {/* 标题行 */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">
          进度记录 ({logs.length})
        </span>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-indigo-600 hover:bg-indigo-50"
        >
          <Plus className="h-3 w-3" />
          记录进度
        </button>
      </div>

      {/* 添加表单 */}
      {showAdd && (
        <div className="space-y-2 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-600">{unitHint}：</label>
            <input
              type="number"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder={unitPlaceholder}
              min="0"
              step={unit === '元' ? '0.01' : unit === '小时' ? '0.5' : '1'}
              className="w-24 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-indigo-300"
            />
            <span className="text-xs text-slate-500">{unit || ''}</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-600">备注：</label>
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="说明进度来源（如：收到项目A回款）"
              className="flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-indigo-300"
            />
          </div>
          <p className="text-[10px] text-slate-500">
            💡 记录后进度会自动累加，删除记录会自动回退
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAdd(false)}
              className="rounded-md px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
            >
              取消
            </button>
            <button
              onClick={handleAdd}
              disabled={!newValue || Number(newValue) <= 0}
              className="rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              记录
            </button>
          </div>
        </div>
      )}

      {/* 日记列表 */}
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        </div>
      ) : logs.length === 0 ? (
        <p className="py-3 text-center text-xs text-slate-400">暂无进度记录</p>
      ) : (
        <div className="space-y-1.5">
          {logs.map((log) => (
            <div
              key={log.id}
              className="group flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-slate-50"
            >
              {/* 日期 */}
              <div className="flex shrink-0 items-center gap-1 text-[11px] text-slate-500">
                <Calendar className="h-3 w-3" />
                {formatDate(log.date)}
              </div>
              {/* 进度值 */}
              <span className="shrink-0 font-mono text-xs font-semibold text-indigo-600">
                +{formatValue(log.value, unit)}
              </span>
              {/* 备注 */}
              {log.note && (
                <div className="flex min-w-0 flex-1 items-center gap-1 text-xs text-slate-500">
                  <MessageSquare className="h-3 w-3 shrink-0" />
                  <span className="truncate">{log.note}</span>
                </div>
              )}
              {/* 删除 */}
              <button
                onClick={() => onDelete(log.id)}
                className="shrink-0 rounded p-1 text-slate-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function formatValue(value: number, unit?: string): string {
  if (unit === '元') {
    return `¥${value >= 10000 ? `${(value / 10000).toFixed(1)}万` : value.toLocaleString()}`;
  }
  return `${value}${unit || ''}`;
}
