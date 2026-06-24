'use client';

import { useState, useRef, useEffect, memo } from 'react';
import { cn } from '@/lib/utils';
import {
  Calendar, MoreVertical, Edit3, Trash2, AlertTriangle,
  FolderKanban, RefreshCw, CheckCircle2, TrendingUp, Flame,
} from 'lucide-react';
import type { Goal, MetricType, MetricCategory } from '@/hooks/useGoals';
import { useCheckin } from '@/hooks/useGoals';

// ═══ 常量 ═══

const typeLabel: Record<string, string> = { MONTHLY: '月度', QUARTERLY: '季度', YEARLY: '年度' };

export const METRIC_CATEGORIES: { key: MetricCategory; label: string; metrics: MetricType[] }[] = [
  { key: 'business', label: '💼 经营业务', metrics: ['REVENUE', 'PROFIT', 'NEW_ORDERS', 'PROJECT_COUNT', 'DELIVERY_RATE'] },
  { key: 'tasks', label: '📋 任务管理', metrics: ['TASK_COMPLETION', 'TASK_RATE', 'OVERDUE_REDUCTION'] },
  { key: 'customers', label: '🤝 客户关系', metrics: ['NEW_CUSTOMERS', 'CUSTOMER_VISITS', 'SATISFACTION'] },
  { key: 'growth', label: '🌱 个人成长', metrics: ['SKILL_HOURS', 'HABIT_STREAK', 'MILESTONE'] },
];

export const metricConfig: Record<MetricType, { label: string; icon: string; desc: string; unit: string; category: MetricCategory }> = {
  REVENUE:           { label: '收入',     icon: '💰', desc: '已完成订单回款',           unit: '元', category: 'business' },
  PROFIT:            { label: '利润',     icon: '📈', desc: '收入减去成本',             unit: '元', category: 'business' },
  NEW_ORDERS:        { label: '新订单',   icon: '📦', desc: '新接订单数量',             unit: '个', category: 'business' },
  PROJECT_COUNT:     { label: '完成项目', icon: '✅', desc: '按时完成项目数',           unit: '个', category: 'business' },
  DELIVERY_RATE:     { label: '交付率',   icon: '🎯', desc: '按时交付比例',             unit: '%',  category: 'business' },
  TASK_COMPLETION:   { label: '任务完成', icon: '☑️', desc: '已完成任务总数',           unit: '个', category: 'tasks' },
  TASK_RATE:         { label: '完成率',   icon: '📊', desc: '任务完成比例',             unit: '%',  category: 'tasks' },
  OVERDUE_REDUCTION: { label: '逾期控制', icon: '⏰', desc: '逾期任务占比（越低越好）', unit: '%',  category: 'tasks' },
  NEW_CUSTOMERS:     { label: '新客户',   icon: '🤝', desc: '新增客户数量',             unit: '位', category: 'customers' },
  CUSTOMER_VISITS:   { label: '客户回访', icon: '📞', desc: '回访沟通次数',             unit: '次', category: 'customers' },
  SATISFACTION:      { label: '满意度',   icon: '⭐', desc: '客户满意度评分',           unit: '分', category: 'customers' },
  SKILL_HOURS:       { label: '学习时长', icon: '📚', desc: '学习/培训时间',            unit: '小时', category: 'growth' },
  HABIT_STREAK:      { label: '习惯打卡', icon: '🔥', desc: '连续打卡天数',             unit: '天', category: 'growth' },
  MILESTONE:         { label: '里程碑',   icon: '🏁', desc: '按节点推进',               unit: '',   category: 'growth' },
};

const statusConfig: Record<string, { label: string; cls: string; dotCls: string }> = {
  ACTIVE: { label: '进行中', cls: 'bg-blue-50 text-blue-600', dotCls: 'bg-blue-500' },
  COMPLETED: { label: '已完成', cls: 'bg-emerald-50 text-emerald-600', dotCls: 'bg-emerald-500' },
  ABANDONED: { label: '已放弃', cls: 'bg-slate-100 text-slate-400', dotCls: 'bg-slate-400' },
  AT_RISK: { label: '落后', cls: 'bg-red-50 text-red-600', dotCls: 'bg-red-500' },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function daysLeft(end: string) {
  return Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / 86400000));
}

function calcStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const sorted = [...new Set(dates)].sort().reverse();
  const today = new Date().toISOString().split('T')[0];
  let streak = 0;
  let expected = today;
  for (const d of sorted) {
    const dt = new Date(expected + 'T00:00:00');
    dt.setDate(dt.getDate() - 1);
    const yesterday = dt.toISOString().split('T')[0];
    if (d === expected) {
      streak++;
      expected = yesterday;
    } else if (d === yesterday && streak === 0) {
      // 今天还没打卡，从昨天开始算
      streak++;
      const prev = new Date(yesterday + 'T00:00:00');
      prev.setDate(prev.getDate() - 1);
      expected = prev.toISOString().split('T')[0];
    } else {
      break;
    }
  }
  return streak;
}

function formatValue(value: number, metricType: MetricType, unit?: string | null): string {
  if (metricType === 'REVENUE' || metricType === 'PROFIT') {
    return value >= 10000 ? `¥${(value / 10000).toFixed(1)}万` : `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
  }
  if (metricType === 'DELIVERY_RATE' || metricType === 'TASK_RATE' || metricType === 'OVERDUE_REDUCTION') return `${Math.round(value)}%`;
  if (metricType === 'SATISFACTION') return `${Math.round(value)}分`;
  if (metricType === 'SKILL_HOURS') return `${value}小时`;
  const u = unit || metricConfig[metricType]?.unit || '';
  return `${value}${u}`;
}

// ═══ Props ═══

interface GoalCardProps {
  goal: Goal;
  onEdit?: (goal: Goal) => void;
  onDelete?: (id: string) => void;
  onCalculate?: (id: string) => void;
}

// ═══ 组件 ═══

export const GoalCard = memo(function GoalCard({ goal, onEdit, onDelete, onCalculate }: GoalCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const checkinMut = useCheckin(goal.id);

  const status = statusConfig[goal.status] || statusConfig.ACTIVE;
  const metric = metricConfig[goal.metricType as MetricType] || metricConfig.REVENUE;
  const isComplete = goal.status === 'COMPLETED';
  const isAtRisk = goal.status === 'AT_RISK';
  const remaining = daysLeft(goal.endDate);
  const isMilestone = goal.metricType === 'MILESTONE';
  const isCheckin = goal.progressMode === 'CHECKIN' || goal.metricType === 'HABIT_STREAK';
  const milestones = goal.milestones || [];
  const doneMs = milestones.filter(m => m.completed).length;
  const checkins = goal.checkins || [];
  const streak = calcStreak(checkins.map(c => c.date));

  const isInverse = goal.metricType === 'OVERDUE_REDUCTION'; // 越低越好

  const progress = isMilestone
    ? (milestones.length > 0 ? Math.round(doneMs / milestones.length * 100) : 0)
    : goal.targetValue != null && goal.targetValue > 0
      ? isInverse
        ? Math.max(0, Math.min(100, Math.round((1 - (goal.currentValue - goal.targetValue) / goal.targetValue) * 100)))
        : Math.min(100, Math.round(goal.currentValue / goal.targetValue * 100))
      : 0;

  // 进度条颜色
  const barColor = isComplete ? 'bg-emerald-500' : isAtRisk ? 'bg-red-500' : progress >= 60 ? 'bg-indigo-500' : 'bg-amber-500';

  useEffect(() => {
    if (!showMenu) return;
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showMenu]);

  async function handleCalculate() {
    if (!onCalculate) return;
    setCalculating(true);
    try { await onCalculate(goal.id); } finally { setCalculating(false); }
  }

  function handleCheckin() {
    const today = new Date().toISOString().split('T')[0];
    if (checkins.some(c => c.date === today)) return;
    checkinMut.mutate({ date: today }, {
      onSuccess: () => {
        // 打卡后检查：如果即将达标（目标值存在且当前+1 >= 目标值），触发庆祝
        const newCount = checkins.length + 1;
        if (goal.targetValue && newCount >= goal.targetValue) {
          setCelebrating(true);
          setTimeout(() => setCelebrating(false), 2500);
        }
      },
    });
  }

  return (
    <div className={cn(
      'group relative rounded-xl border bg-card px-5 py-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
      isComplete ? 'border-border/60 opacity-60' : isAtRisk ? 'border-red-200 bg-red-50/30 dark:bg-red-950/20' : 'border-border',
    )}>
      {/* 头部：标题 + 状态 + 菜单 */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-base">{metric.icon}</span>
            <h3 className={cn('truncate text-sm font-semibold', isComplete ? 'text-muted-foreground line-through' : 'text-foreground')}>
              {goal.title}
            </h3>
            <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-2xs font-medium', status.cls)}>
              {status.label}
            </span>
            {isAtRisk && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />}
          </div>

          {/* 元信息 */}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs-plus text-muted-foreground">
            <span>{metric.label} · {typeLabel[goal.type]}</span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />{fmtDate(goal.startDate)} → {fmtDate(goal.endDate)}
            </span>
            {!isComplete && (
              <span className={cn('flex items-center gap-1', remaining <= 3 ? 'text-red-500 font-semibold' : '')}>
                剩余 {remaining} 天
              </span>
            )}
            {goal.project && (
              <span className="flex items-center gap-1">
                <FolderKanban className="h-3 w-3" />{goal.project.name}
              </span>
            )}
          </div>
        </div>

        {/* 菜单 */}
        <div className="relative shrink-0" ref={menuRef}>
          <button onClick={() => setShowMenu(!showMenu)}
            className="rounded-md p-1 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-muted-foreground">
            <MoreVertical className="h-4 w-4" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-6 z-20 w-36 rounded-lg border border-border bg-card py-1 shadow-lg text-xs">
              {goal.progressMode === 'AUTO' && onCalculate && (
                <button onClick={() => { handleCalculate(); setShowMenu(false); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent">
                  <RefreshCw className={cn('h-3 w-3', calculating && 'animate-spin')} />一键计算
                </button>
              )}
              {onEdit && (
                <button onClick={() => { onEdit(goal); setShowMenu(false); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent">
                  <Edit3 className="h-3 w-3" />编辑
                </button>
              )}
              {onDelete && (
                <button onClick={() => { onDelete(goal.id); setShowMenu(false); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-red-500 hover:bg-red-50">
                  <Trash2 className="h-3 w-3" />删除
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 进度区域 */}
      <div className="mt-3">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className={cn('text-lg font-bold', isAtRisk ? 'text-red-600' : isComplete ? 'text-emerald-600' : 'text-foreground')}>
              {formatValue(goal.currentValue, goal.metricType, goal.unit)}
            </span>
            {goal.targetValue != null && (
              <span className="text-xs text-muted-foreground">
                / {formatValue(goal.targetValue, goal.metricType, goal.unit)}
              </span>
            )}
          </div>
          <span className={cn('text-sm font-bold', isAtRisk ? 'text-red-600' : isComplete ? 'text-emerald-600' : 'text-indigo-600')}>
            {progress}%
          </span>
        </div>

        {/* 进度条 */}
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
          <div className={cn('h-full rounded-full progress-animate', barColor)}
            style={{ width: `${Math.min(100, progress)}%` }} />
        </div>

        {/* 里程碑进度 */}
        {isMilestone && milestones.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {milestones.map(m => (
              <span key={m.id} className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium',
                m.completed ? 'bg-emerald-50 text-emerald-600' : 'bg-muted text-muted-foreground',
              )}>
                {m.completed ? <CheckCircle2 className="h-2.5 w-2.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />}
                {m.title}
              </span>
            ))}
          </div>
        )}

        {/* 打卡区域 */}
        {isCheckin && !isComplete && (
          <div className="mt-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {streak > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-2xs font-semibold text-orange-600">
                    <Flame className="h-3 w-3" />连续 {streak} 天
                  </span>
                )}
                <span className="text-2xs text-muted-foreground">
                  已打卡 {checkins.length}{goal.targetValue ? ` / ${goal.targetValue}` : ''} 天
                </span>
              </div>
              <button onClick={handleCheckin}
                disabled={checkins.some(c => c.date === new Date().toISOString().split('T')[0]) || checkinMut.isPending}
                className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {checkins.some(c => c.date === new Date().toISOString().split('T')[0]) ? '今日已打卡' : '打卡'}
              </button>
            </div>
            {/* 迷你日历 */}
            <MiniCheckinCalendar checkins={checkins.map(c => c.date)} />
          </div>
        )}

        {/* 完成庆祝 */}
        {celebrating && <Confetti />}

        {/* 风险提示 */}
        {isAtRisk && !isComplete && (
          <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-2xs-plus text-red-600">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span>进度落后预期，{remaining <= 3 ? '时间紧迫，请优先推进' : '建议检查并调整计划'}</span>
          </div>
        )}
      </div>
    </div>
  );
})

// ═══ 迷你打卡日历 ═══

function MiniCheckinCalendar({ checkins }: { checkins: string[] }) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = now.toISOString().split('T')[0];
  const checkinSet = new Set(checkins);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div className="mt-2 rounded-lg bg-muted/30 p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-2xs font-medium text-muted-foreground">{y}年{m + 1}月</span>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {weekDays.map(d => (
          <span key={d} className="text-2xs text-muted-foreground/50 leading-5">{d}</span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`e${i}`} />;
          const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const checked = checkinSet.has(dateStr);
          const isToday = dateStr === today;
          return (
            <span key={i} className={cn(
              'inline-flex h-5 w-5 items-center justify-center rounded-full text-2xs leading-5',
              checked && 'bg-indigo-500 text-white font-semibold',
              !checked && isToday && 'ring-1 ring-indigo-400 text-indigo-600 font-medium',
              !checked && !isToday && 'text-muted-foreground/40',
            )}>
              {day}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Confetti() {
  const colors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#8b5cf6'];
  const pieces = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    left: `${5 + Math.random() * 90}%`,
    delay: `${Math.random() * 0.5}s`,
    duration: `${1.5 + Math.random() * 1}s`,
    color: colors[i % colors.length],
    size: 4 + Math.random() * 4,
    rotate: Math.random() * 360,
  }));

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl" aria-hidden>
      {pieces.map(p => (
        <span key={p.id}
          className="absolute -top-2 animate-[confetti-fall_linear_forwards] rounded-sm opacity-80"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
            transform: `rotate(${p.rotate}deg)`,
          }} />
      ))}
      <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-emerald-600 animate-[celebrate-pop_0.5s_ease-out_forwards]">
        🎉 目标达成！
      </span>
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(300px) rotate(720deg); opacity: 0; }
        }
        @keyframes celebrate-pop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
