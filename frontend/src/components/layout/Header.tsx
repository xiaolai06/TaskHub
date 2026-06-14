'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  LogOut, User, Settings, Sparkles, ChevronDown,
  Bell, Clock, CheckSquare, Plus, FolderKanban, Users,
  Newspaper, TrendingUp, AlertCircle, Sun, Moon,
  CheckCheck, ChevronUp, ChevronDown as ChevronDownIcon,
  History, X, Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkTools } from '@/components/features/work/WorkTools';
import { useTheme } from '@/components/providers/ThemeProvider';
import { MarkdownRenderer } from '@/components/features/ai/MarkdownRenderer';

/* ── Types ────────────────────────────────────── */

interface QuickTask {
  id: string;
  title: string;
  priority: string;
  dueDate: string | null;
  project: { name: string };
}

interface InfoItem {
  id: string;
  type: 'task' | 'project' | 'system' | 'alert';
  title: string;
  desc: string;
  time: string;
  read: boolean;
}

interface HeaderProps {
  onOpenAi?: () => void;
}

/* ── Constants ────────────────────────────────── */

const DESC_TRUNCATE_LEN = 80;
const HISTORY_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'task', label: '任务' },
  { key: 'project', label: '项目' },
  { key: 'system', label: '系统' },
  { key: 'alert', label: '告警' },
] as const;

/* ── Helpers ──────────────────────────────────── */

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

/** 时钟 */
function LiveClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    function tick() {
      setTime(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <>{time}</>;
}

/** 内置祝福语库 */
const builtinGreetings: Record<string, string[]> = {
  earlyMorning: [
    '早安，新的一天开始了 ☀️', '早上好，今天也要加油呀', '早安，记得吃早餐哦',
    '早起的鸟儿有虫吃 🐦', '早安，美好的一天从现在开始', '早上好，今天是充满可能的一天',
    '早安，元气满满地出发吧', '清晨的阳光为你而来 🌄',
  ],
  morning: [
    '上午好，专注工作 💪', '上午好，效率满满', '上午好，保持节奏',
    '上午好，今天有什么新目标？', '上午好，一步一步来', '上午好，专注是最好的效率',
    '上午好，把重要的事先做完', '上午好，深呼吸，继续前进',
  ],
  noon: [
    '中午好，该休息一下了 🍜', '中午好，别忘了午休', '中午好，吃饱才有力气干活',
    '中午好，短暂休息是为了走更远', '中午好，给自己充充电 🔋',
  ],
  afternoon: [
    '下午好，继续加油 ☕', '下午好，保持专注', '下午好，离目标又近了一步',
    '下午好，一杯咖啡的时间 ☕', '下午好，下午也要元气满满', '下午好，稳扎稳打',
    '下午好，今天的你很棒', '下午好，坚持就是胜利',
  ],
  evening: [
    '傍晚好，辛苦了 🌅', '傍晚好，收尾工作', '傍晚好，快完成今天的目标了',
    '傍晚好，今天的努力不会白费', '傍晚好，给自己一个微笑 😊', '傍晚好，总结一下今天的收获',
  ],
  night: [
    '晚上好，注意休息 🌙', '晚上好，别太晚了', '晚上好，适当放松一下',
    '晚上好，辛苦了一整天', '晚上好，明天会更好', '晚上好，给自己一点独处时光',
    '晚上好，复盘一下今天吧', '晚上好，早点休息哦',
  ],
  lateNight: [
    '夜深了，早点休息吧 🌛', '夜猫子模式 🦉', '夜深了，身体最重要',
    '夜深了，明天的事明天再说', '夜深了，放下手机去睡觉 😴', '夜深了，好梦在等你',
  ],
};

function getBuiltinSlot(hour: number): string[] {
  if (hour >= 6 && hour <= 8) return builtinGreetings.earlyMorning;
  if (hour >= 9 && hour <= 11) return builtinGreetings.morning;
  if (hour >= 12 && hour <= 13) return builtinGreetings.noon;
  if (hour >= 14 && hour <= 16) return builtinGreetings.afternoon;
  if (hour >= 17 && hour <= 19) return builtinGreetings.evening;
  if (hour >= 20 && hour <= 22) return builtinGreetings.night;
  return builtinGreetings.lateNight;
}

function getGreeting(name: string, customGreetings: string[]): string {
  const hour = new Date().getHours();
  const builtin = getBuiltinSlot(hour);
  const all = [...customGreetings, ...builtin];
  const msg = all[Math.floor(Date.now() / 60000) % all.length];
  return `${name}，${msg}`;
}

const navBtn = 'inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground/70 transition-all duration-100 hover:border-border hover:bg-accent active:scale-95 active:bg-accent';

const infoIcon = (type: InfoItem['type']) => {
  switch (type) {
    case 'alert': return <AlertCircle className="h-4 w-4 text-red-500" />;
    case 'project': return <TrendingUp className="h-4 w-4 text-indigo-500" />;
    case 'task': return <CheckSquare className="h-4 w-4 text-blue-500" />;
    case 'system': return <Newspaper className="h-4 w-4 text-slate-400" />;
  }
};

/* ── Component ────────────────────────────────── */

export function Header({ onOpenAi }: HeaderProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, setTheme, resolved } = useTheme();
  const queryClient = useQueryClient();
  const [customGreetings, setCustomGreetings] = useState<string[]>([]);

  /* panel visibility */
  const [showTasks, setShowTasks] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const taskRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  /* history filter */
  const [historyFilter, setHistoryFilter] = useState<string>('all');

  /* 已读任务 IDs（localStorage 持久化，1天后自动清除） */
  const READ_TASKS_KEY = 'header_read_tasks';
  const [readTaskIds, setReadTaskIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(READ_TASKS_KEY);
      if (!raw) return new Set();
      const map = JSON.parse(raw) as Record<string, number>;
      const now = Date.now();
      const ONE_DAY = 86_400_000;
      // 清除超过1天的
      const fresh = Object.entries(map).filter(([, ts]) => now - ts < ONE_DAY);
      return new Set(fresh.map(([id]) => id));
    } catch { return new Set(); }
  });

  // 持久化到 localStorage
  useEffect(() => {
    const map: Record<string, number> = {};
    readTaskIds.forEach((id) => { map[id] = Date.now(); });
    // 合并已有记录（保留时间戳）
    try {
      const raw = localStorage.getItem(READ_TASKS_KEY);
      if (raw) {
        const old = JSON.parse(raw) as Record<string, number>;
        Object.assign(map, old);
      }
    } catch { /* 忽略 */ }
    localStorage.setItem(READ_TASKS_KEY, JSON.stringify(map));
  }, [readTaskIds]);

  function toggleTheme() {
    setTheme(resolved === 'light' ? 'dark' : 'light');
  }

  /* ── Data Fetching ──────────────────────────── */

  const { data: quickTasksData } = useQuery({
    queryKey: ['header', 'recent-tasks'],
    queryFn: async () => {
      const res = await api.get<{ tasks: QuickTask[] }>('/dashboard/recent-activity');
      return Array.isArray(res?.tasks) ? res.tasks : [];
    },
    staleTime: 10_000,
  });
  const quickTasks = Array.isArray(quickTasksData) ? quickTasksData : [];
  const ONE_DAY_MS = 86_400_000;
  const alertCount = quickTasks.filter((t) => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate).getTime();
    return due < Date.now() + ONE_DAY_MS; // 逾期或1天内到期
  }).length;
  // 排序：逾期最久 → 快到期 → 无日期，已读排最后
  const sortedTasks = [...quickTasks].sort((a, b) => {
    const aRead = readTaskIds.has(a.id) ? 1 : 0;
    const bRead = readTaskIds.has(b.id) ? 1 : 0;
    if (aRead !== bRead) return aRead - bRead;
    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return aDue - bDue;
  });

  useEffect(() => {
    api.get<Array<{ content: string }>>('/greetings')
      .then((res) => setCustomGreetings(res.map((g) => g.content)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (taskRef.current && !taskRef.current.contains(e.target as Node)) setShowTasks(false);
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setShowInfo(false);
        setShowHistory(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleLogout() {
    logout();
    router.push('/auth-pages/login');
  }

  const initials = user?.name ? user.name.slice(0, 2).toUpperCase() : 'U';
  const roleLabel = user?.role === 'ADMIN' ? '管理员' : '成员';

  /* ── Notifications State ────────────────────── */

  const [infoItems, setInfoItems] = useState<InfoItem[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data: notificationsData } = useQuery({
    queryKey: ['header', 'notifications'],
    queryFn: async () => {
      const res = await api.get<Array<{ id: string; type: string; title: string; content: string; read: boolean; createdAt: string }>>('/notifications?limit=20');
      const raw = Array.isArray(res) ? res : (res as any)?.data || [];
      return raw.map((n: any) => ({
        id: n.id,
        type: n.type === 'TASK_DUE' ? 'alert' : n.type === 'PROJECT_CHANGE' ? 'project' : n.type === 'AI_REPORT' ? 'system' : 'system',
        title: n.title,
        desc: n.content || '',
        time: formatRelativeTime(n.createdAt),
        read: n.read,
      })) as InfoItem[];
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (notificationsData) setInfoItems(notificationsData);
  }, [notificationsData]);

  const unreadInfo = infoItems.filter((i) => !i.read).length;
  const readItems = infoItems.filter((i) => i.read);

  const handleMarkAsRead = useCallback(async (id: string) => {
    setInfoItems((prev) => prev.map((it) => it.id === id ? { ...it, read: true } : it));
    try {
      await api.patch(`/notifications/${id}/read`);
      queryClient.invalidateQueries({ queryKey: ['header', 'notifications'] });
    } catch { /* 静默 */ }
  }, [queryClient]);

  const handleMarkAllRead = useCallback(async () => {
    setInfoItems((prev) => prev.map((it) => ({ ...it, read: true })));
    try {
      await api.patch('/notifications/read-all');
      queryClient.invalidateQueries({ queryKey: ['header', 'notifications'] });
    } catch { /* 静默 */ }
  }, [queryClient]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  /** 标记任务已读（变灰，不移除） */
  const markTaskRead = useCallback((id: string) => {
    setReadTaskIds((prev) => new Set(prev).add(id));
  }, []);

  /* ── History Filter ─────────────────────────── */

  const filteredHistory = historyFilter === 'all'
    ? readItems
    : readItems.filter((i) => i.type === historyFilter);

  /* ── Render Helpers ─────────────────────────── */

  function renderItem(item: InfoItem, { compact, showMarkRead }: { compact?: boolean; showMarkRead?: boolean } = {}) {
    const isExpanded = expandedIds.has(item.id);
    const needsTruncate = item.desc.length > DESC_TRUNCATE_LEN;
    const displayDesc = !isExpanded && needsTruncate
      ? item.desc.slice(0, DESC_TRUNCATE_LEN) + '…'
      : item.desc;

    return (
      <div
        key={item.id}
        onClick={() => toggleExpand(item.id)}
        className={cn(
          'flex items-start gap-3 px-4 transition-colors hover:bg-accent cursor-pointer',
          compact ? 'py-2' : 'py-2.5',
          !item.read ? 'bg-blue-50/30 dark:bg-blue-950/30' : 'opacity-80',
        )}
      >
        <div className="mt-0.5 shrink-0">{infoIcon(item.type)}</div>
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm', !item.read ? 'font-semibold text-foreground' : 'font-medium text-foreground/70')}>
            {item.title}
          </p>
          <div className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
            {isExpanded ? (
              <MarkdownRenderer content={item.desc} />
            ) : (
              <span>{displayDesc}</span>
            )}
            {needsTruncate && (
              <span className="ml-1 inline-flex items-center gap-0.5 text-2xs-plus text-indigo-500">
                {isExpanded ? <><ChevronUp className="h-3 w-3" />收起</> : <><ChevronDownIcon className="h-3 w-3" />展开</>}
              </span>
            )}
          </div>
          <p className="mt-1 text-2xs-plus text-muted-foreground">{item.time}</p>
        </div>
        {/* 已读标记 */}
        {!item.read && showMarkRead ? (
          <button
            onClick={(e) => { e.stopPropagation(); handleMarkAsRead(item.id); }}
            className="mt-1 shrink-0 rounded p-0.5 text-blue-500 transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/40"
            title="标为已读"
          >
            <CheckCheck className="h-3.5 w-3.5" />
          </button>
        ) : !item.read ? (
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
        ) : null}
      </div>
    );
  }

  /* ── JSX ────────────────────────────────────── */

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/95 px-5 backdrop-blur-md">
      {/* 左侧：时间 + 祝福语 + 主题切换 */}
      <div className="flex items-center gap-3">
        <div className="flex shrink-0 items-center gap-1.5 font-mono text-base text-slate-500 tabular-nums">
          <Clock className="h-4 w-4 text-slate-400" />
          <LiveClock />
        </div>
        <div className="h-5 w-px shrink-0 bg-slate-200" />
        <span className="text-base text-slate-500">
          {user?.name ? getGreeting(user.name, customGreetings) : '欢迎使用 智汇轻营'}
        </span>
        <button
          onClick={toggleTheme}
          className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
          title={resolved === 'light' ? '切换到暗色模式' : '切换到亮色模式'}
        >
          {resolved === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
      </div>

      {/* 右侧：操作按钮组 */}
      <div className="flex shrink-0 items-center gap-2">
        <WorkTools />

        {/* 新建 */}
        <DropdownMenu>
          <DropdownMenuTrigger className={navBtn}>
            <Plus className="h-4 w-4" />
            新建
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => router.push('/main/projects')}>
              <FolderKanban className="mr-2 h-4 w-4 text-indigo-500" />新建项目
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/main/tasks')}>
              <CheckSquare className="mr-2 h-4 w-4 text-blue-500" />新建任务
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/main/customers')}>
              <Users className="mr-2 h-4 w-4 text-emerald-500" />新建客户
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* ─── 资讯 ─── */}
        <div className="relative" ref={infoRef}>
          <button onClick={() => { setShowInfo(!showInfo); setShowTasks(false); }} onMouseDown={(e) => e.stopPropagation()} className={cn(navBtn, 'relative')}>
            <Newspaper className="h-4 w-4" />
            资讯
            {unreadInfo > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-2xs font-bold text-white">
                {unreadInfo}
              </span>
            )}
          </button>

          {showInfo && (
            <div className="absolute right-0 top-full z-50 mt-2 w-96 rounded-xl border border-border bg-card shadow-xl">
              {/* 头部 */}
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <span className="text-sm font-semibold text-foreground">消息资讯</span>
                <div className="flex items-center gap-2">
                  {unreadInfo > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs-plus text-indigo-600 transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                    >
                      <CheckCheck className="h-3 w-3" />全部已读
                    </button>
                  )}
                  {/* 历史小组件入口 */}
                  {readItems.length > 0 && (
                    <button
                      onClick={() => setShowHistory(!showHistory)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs-plus transition-colors',
                        showHistory
                          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                          : 'text-muted-foreground hover:bg-accent',
                      )}
                      title="查看已读历史"
                    >
                      <History className="h-3 w-3" />历史({readItems.length})
                    </button>
                  )}
                </div>
              </div>

              {/* 未读区 */}
              <div className="max-h-64 divide-y overflow-y-auto">
                {infoItems.filter((i) => !i.read).length === 0 && readItems.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    <Newspaper className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />暂无消息
                  </div>
                ) : infoItems.filter((i) => !i.read).length === 0 ? (
                  <div className="px-4 py-4 text-center text-xs text-muted-foreground">全部已读 🎉</div>
                ) : (
                  infoItems.filter((i) => !i.read).map((item) => renderItem(item, { showMarkRead: true }))
                )}
              </div>

              {/* 历史弹窗（展开后覆盖在面板下方） */}
              {showHistory && readItems.length > 0 && (
                <div ref={historyRef} className="border-t border-border">
                  {/* 筛选条 */}
                  <div className="flex items-center gap-1 border-b border-border/50 bg-muted/40 px-3 py-1.5">
                    <Filter className="h-3 w-3 text-muted-foreground" />
                    {HISTORY_FILTERS.map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setHistoryFilter(f.key)}
                        className={cn(
                          'rounded-md px-2 py-0.5 text-2xs-plus transition-colors',
                          historyFilter === f.key
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 font-medium'
                            : 'text-muted-foreground hover:bg-accent',
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  {/* 历史列表 */}
                  <div className="max-h-56 divide-y overflow-y-auto">
                    {filteredHistory.length === 0 ? (
                      <div className="px-4 py-4 text-center text-2xs-plus text-muted-foreground">暂无该类历史消息</div>
                    ) : (
                      filteredHistory.map((item) => renderItem(item, { compact: true }))
                    )}
                  </div>
                </div>
              )}

              <div className="border-t px-4 py-2">
                <button
                  onClick={() => { setShowInfo(false); router.push('/main/settings'); }}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                >
                  查看全部消息 →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ─── 待办 ─── */}
        <div className="relative" ref={taskRef}>
          <button onClick={() => { setShowTasks(!showTasks); setShowInfo(false); }} onMouseDown={(e) => e.stopPropagation()} className={cn(navBtn, 'relative')}>
            <Bell className="h-4 w-4" />
            待办
            {alertCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-2xs font-bold text-white">
                {alertCount}
              </span>
            )}
          </button>

          {showTasks && (
            <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border bg-card shadow-xl">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <span className="text-sm font-semibold text-foreground">待办任务</span>
                <span className="text-xs text-muted-foreground">
                  {quickTasks.length} 项
                  {alertCount > 0 && <span className="ml-1 text-red-500">（{alertCount} 项逾期/即将到期）</span>}
                </span>
              </div>
              {quickTasks.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  <CheckSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />暂无待办任务
                </div>
              ) : (
                <div className="max-h-[28rem] divide-y divide-border overflow-y-auto">
                  {sortedTasks.map((task) => {
                    const overdue = isOverdue(task.dueDate);
                    const soonDue = !overdue && task.dueDate && new Date(task.dueDate).getTime() < Date.now() + ONE_DAY_MS;
                    const isRead = readTaskIds.has(task.id);
                    return (
                      <div key={task.id} className={cn(
                        'flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent',
                        isRead ? 'opacity-50' : (overdue || soonDue) && 'bg-red-50/40 dark:bg-red-950/20',
                      )}>
                        <span className={cn(
                          'mt-1 h-2 w-2 shrink-0 rounded-full',
                          isRead ? 'bg-slate-300' :
                          overdue ? 'bg-red-500 animate-pulse' :
                          soonDue ? 'bg-orange-400 animate-pulse' :
                          task.priority === 'URGENT' || task.priority === 'HIGH' ? 'bg-red-400' :
                          task.priority === 'MEDIUM' ? 'bg-amber-400' : 'bg-slate-300',
                        )} />
                        <div className="min-w-0 flex-1">
                          <p className={cn('truncate text-sm font-medium', isRead ? 'text-muted-foreground line-through' : overdue ? 'text-red-700 dark:text-red-400' : 'text-foreground')}>
                            {task.title}
                            {overdue && !isRead && <span className="ml-1 text-2xs text-red-500 font-normal">逾期</span>}
                            {soonDue && !isRead && <span className="ml-1 text-2xs text-orange-500 font-normal">即将到期</span>}
                            {isRead && <span className="ml-1 text-2xs text-muted-foreground font-normal">已读</span>}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{task.project.name}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {task.dueDate && (
                            <span className={cn('flex items-center gap-1 text-2xs-plus', overdue && !isRead ? 'text-red-500' : 'text-muted-foreground')}>
                              <Clock className="h-3 w-3" />{new Date(task.dueDate).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                          {!isRead && (
                            <button
                              onClick={(e) => { e.stopPropagation(); markTaskRead(task.id); }}
                              className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-emerald-100 hover:text-emerald-600 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400"
                              title="标记已读"
                            >
                              <CheckSquare className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="border-t px-4 py-2">
                <a href="/main/tasks" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">查看全部任务 →</a>
              </div>
            </div>
          )}
        </div>

        {/* AI */}
        <button onClick={onOpenAi} className={navBtn}>
          <Sparkles className="h-4 w-4" />
          AI
        </button>

        {/* 分隔 */}
        <div className="mx-0.5 h-6 w-px bg-border" />

        {/* 用户 */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-all duration-100 hover:bg-accent active:scale-95">
            {user?.avatar && user.avatar.startsWith('data:') ? (
              <img src={user.avatar} alt="头像" className="h-9 w-9 rounded-full object-cover" />
            ) : user?.avatar && user.avatar.startsWith('bg-') ? (
              <div className={cn('flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white', user.avatar)}>
                {initials}
              </div>
            ) : (
              <Avatar className="h-9 w-9" size="default">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            )}
            <div className="hidden text-left md:block">
              <p className="text-sm font-medium text-foreground">{user?.name || '未登录'}</p>
              <p className="text-2xs-plus text-muted-foreground">{roleLabel}</p>
            </div>
            <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 md:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="flex flex-col gap-0.5">
                  <span>{user?.name}</span>
                  <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/main/profile')}>
              <User className="mr-2 h-4 w-4" />个人信息
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/main/preferences')}>
              <Settings className="mr-2 h-4 w-4" />偏好设置
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
              <LogOut className="mr-2 h-4 w-4" />退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
