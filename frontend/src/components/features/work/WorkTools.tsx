'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Timer, Play, Pause, Square, Plus, Trash2,
  Check, Loader2, ListTodo, X,
} from 'lucide-react';

// ========== 类型 ==========

interface WorkTimer {
  id: string; description: string | null; taskId: string | null;
  startedAt: string; endedAt: string | null; totalMinutes: number; active: boolean;
}

interface TodayTodoItem {
  id: string; content: string; completed: boolean;
}

interface TaskOption {
  id: string; title: string; project: { name: string }; actualHours?: number | null; estimatedHours?: number;
}

// ========== 计时器卡片 ==========

function TimerCard({ timer, onPause, onStop }: {
  timer: WorkTimer; onPause: (id: string) => void; onStop: (id: string) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function tick() {
      const start = new Date(timer.startedAt).getTime();
      setElapsed(Math.floor((Date.now() - start) / 1000) + Math.floor(timer.totalMinutes * 60));
    }
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timer.startedAt, timer.totalMinutes]);

  function fmt(s: number) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
      <div className="flex items-center justify-between">
        <span className="truncate text-xs font-medium text-slate-700">
          {timer.description || '计时中'}
        </span>
        <div className="flex items-center gap-1">
          <button onClick={() => onPause(timer.id)} className="rounded p-0.5 text-amber-500 hover:bg-amber-50">
            <Pause className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onStop(timer.id)} className="rounded p-0.5 text-red-400 hover:bg-red-50">
            <Square className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <p className="mt-1 font-mono text-lg font-bold text-slate-800 tabular-nums">{fmt(elapsed)}</p>
    </div>
  );
}

// ========== 计时器面板 ==========

function TimerPanel({ onClose }: { onClose: () => void }) {
  const [timers, setTimers] = useState<WorkTimer[]>([]);
  const [desc, setDesc] = useState('');
  const [taskId, setTaskId] = useState('');
  const [tasks, setTasks] = useState<TaskOption[]>([]);

  useEffect(() => {
    api.get<WorkTimer[]>('/work/timer/active').then((res) => {
      const list = Array.isArray(res) ? res : [];
      setTimers(list.filter((t) => t.active && !t.endedAt));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    // 加载全部未完成任务供绑定选择
    api.get<{ data: TaskOption[] }>('/tasks?limit=200')
      .then((res) => setTasks((res.data || []).filter((t: TaskOption) => t.title)))
      .catch(() => {});
  }, []);

  async function handleStart() {
    if (!desc.trim()) return;
    const t = await api.post<WorkTimer>('/work/timer/start', {
      description: desc.trim(), taskId: taskId || undefined,
    });
    setTimers((prev) => [...prev, t]);
    setDesc('');
    setTaskId('');
  }

  async function handlePause(id: string) {
    await api.post(`/work/timer/${id}/pause`);
    // 暂停后只从活跃列表移除，计时器数据仍在数据库
    setTimers((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleStop(id: string) {
    await api.post(`/work/timer/${id}/stop`);
    setTimers((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-slate-700">工作时间</span>
        <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">收起</button>
      </div>

      {timers.length > 0 && (
        <div className="mb-3 space-y-2">
          {timers.map((t) => (
            <TimerCard key={t.id} timer={t} onPause={handlePause} onStop={handleStop} />
          ))}
        </div>
      )}

      <div className="space-y-2">
        <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)}
          placeholder="工作说明（必填）" onKeyDown={(e) => e.key === 'Enter' && handleStart()}
          className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200" />

        <select value={taskId} onChange={(e) => setTaskId(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200">
          <option value="">不绑定任务</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.project?.name || ''} · {t.title}
              {t.actualHours != null ? ` [已记录 ${t.actualHours}h]` : t.estimatedHours ? ` [预估 ${t.estimatedHours}h]` : ''}
            </option>
          ))}
        </select>

        <button onClick={handleStart} disabled={!desc.trim()}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          <Play className="h-4 w-4" />开始计时
        </button>
      </div>
    </div>
  );
}

// ========== 今日任务面板 ==========

function TodoPanel({ onClose }: { onClose: () => void }) {
  const [todos, setTodos] = useState<TodayTodoItem[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<TodayTodoItem[]>('/work/todos')
      .then((res) => setTodos(Array.isArray(res) ? res : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd() {
    if (!input.trim()) return;
    try {
      const todo = await api.post<TodayTodoItem>('/work/todos', { content: input.trim() });
      setTodos((prev) => [todo, ...prev]);
      setInput('');
    } catch {}
  }

  async function handleToggle(id: string, completed: boolean) {
    try {
      await api.patch(`/work/todos/${id}`);
      setTodos((prev) => prev.map((i) => i.id === id ? { ...i, completed: !completed } : i));
    } catch {}
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/work/todos/${id}`);
      setTodos((prev) => prev.filter((i) => i.id !== id));
    } catch {}
  }

  const doneCount = todos.filter((t) => t.completed).length;

  return (
    <div className="w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <ListTodo className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-semibold text-slate-700">今日任务</span>
          {todos.length > 0 && <span className="text-[11px] text-slate-500">{doneCount}/{todos.length}</span>}
        </div>
        <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">收起</button>
      </div>

      <div className="flex gap-1.5 mb-3">
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="今天要做什么？" onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200" />
        <button onClick={handleAdd} disabled={!input.trim()}
          className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-white hover:bg-indigo-700 disabled:opacity-50">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-indigo-500" /></div>
      ) : todos.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-400">今天还没有待办事项</p>
      ) : (
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {todos.map((todo) => (
            <div key={todo.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50">
              <button onClick={() => handleToggle(todo.id, todo.completed)}
                className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all',
                  todo.completed ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 hover:border-indigo-400')}>
                {todo.completed && <Check className="h-3 w-3" />}
              </button>
              <span className={cn('flex-1 text-[13px]', todo.completed ? 'text-slate-400 line-through' : 'text-slate-700')}>
                {todo.content}
              </span>
              <button onClick={() => handleDelete(todo.id)}
                className="shrink-0 rounded p-0.5 text-slate-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function WorkTools() {
  const [showTimer, setShowTimer] = useState(false);
  const [showTodo, setShowTodo] = useState(false);

  return (
    <div className="relative flex items-center gap-1">
      <button onClick={() => { setShowTimer(!showTimer); setShowTodo(false); }}
        className={cn('flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-95',
          showTimer && 'border-indigo-300 bg-indigo-50 text-indigo-600')}>
        <Timer className="h-4 w-4" />计时
      </button>

      <button onClick={() => { setShowTodo(!showTodo); setShowTimer(false); }}
        className={cn('flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-95',
          showTodo && 'border-indigo-300 bg-indigo-50 text-indigo-600')}>
        <ListTodo className="h-4 w-4" />任务
      </button>

      {showTimer && <div className="absolute right-0 top-full z-30 mt-1"><TimerPanel onClose={() => setShowTimer(false)} /></div>}
      {showTodo && <div className="absolute right-0 top-full z-30 mt-1"><TodoPanel onClose={() => setShowTodo(false)} /></div>}
    </div>
  );
}
