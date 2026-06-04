'use client';

import { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkTools } from '@/components/features/work/WorkTools';
import { useTheme } from '@/components/providers/ThemeProvider';

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

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
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
  // 合并自定义 + 内置
  const builtin = getBuiltinSlot(hour);
  const all = [...customGreetings, ...builtin];
  const msg = all[Math.floor(Date.now() / 60000) % all.length];
  return `${name}，${msg}`;
}

export function Header({ onOpenAi }: HeaderProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, setTheme, resolved } = useTheme();
  const [customGreetings, setCustomGreetings] = useState<string[]>([]);
  const [showTasks, setShowTasks] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const taskRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);

  function toggleTheme() {
    setTheme(resolved === 'light' ? 'dark' : 'light');
  }

  // 待办任务用 React Query，AI 创建任务后自动刷新
  const { data: quickTasksData } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await api.get<{ tasks: QuickTask[] }>('/dashboard/recent-activity');
      return res.tasks?.slice(0, 5) ?? [];
    },
    staleTime: 10_000,
  });
  const quickTasks = quickTasksData ?? [];

  useEffect(() => {
    api.get<Array<{ content: string }>>('/greetings')
      .then((res) => setCustomGreetings(res.map((g) => g.content)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (taskRef.current && !taskRef.current.contains(e.target as Node)) setShowTasks(false);
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) setShowInfo(false);
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
  const urgentCount = quickTasks.filter((t) => t.priority === 'URGENT' || t.priority === 'HIGH').length;

  const [infoItems, setInfoItems] = useState<InfoItem[]>([]);

  useEffect(() => {
    // 从 Notification 表加载近期 5 条通知
    api.get<Array<{ id: string; type: string; title: string; content: string; read: boolean; createdAt: string }>>('/notifications?limit=5')
      .then((res) => {
        const items: InfoItem[] = (Array.isArray(res) ? res : (res as any)?.data || []).map((n: any) => ({
          id: n.id,
          type: n.type === 'TASK_DUE' ? 'alert' : n.type === 'PROJECT_CHANGE' ? 'project' : n.type === 'AI_REPORT' ? 'system' : 'system',
          title: n.title,
          desc: n.content || '',
          time: formatRelativeTime(n.createdAt),
          read: n.read,
        }));
        setInfoItems(items);
      })
      .catch(() => {});
  }, []);
  const unreadInfo = infoItems.filter((i) => !i.read).length;

  const infoIcon = (type: InfoItem['type']) => {
    switch (type) {
      case 'alert': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'project': return <TrendingUp className="h-4 w-4 text-indigo-500" />;
      case 'task': return <CheckSquare className="h-4 w-4 text-blue-500" />;
      case 'system': return <Newspaper className="h-4 w-4 text-slate-400" />;
    }
  };

  const navBtn = 'inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground/70 transition-all duration-100 hover:border-border hover:bg-accent active:scale-95 active:bg-accent';

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/95 px-5 backdrop-blur-md">
      {/* 左侧：时间 + 祝福语 + 主题切换 */}
      <div className="flex items-center gap-3">
        <div className="flex shrink-0 items-center gap-1.5 font-mono text-[15px] text-slate-500 tabular-nums">
          <Clock className="h-4 w-4 text-slate-400" />
          <LiveClock />
        </div>
        <div className="h-5 w-px shrink-0 bg-slate-200" />
        <span className="text-[15px] text-slate-500">
          {user?.name ? getGreeting(user.name, customGreetings) : '欢迎使用 智汇轻营'}
        </span>
        {/* 主题切换按钮 */}
        <button
          onClick={toggleTheme}
          className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
          title={resolved === 'light' ? '切换到暗色模式' : '切换到亮色模式'}
        >
          {resolved === 'light' ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* 右侧：操作按钮组 */}
      <div className="flex shrink-0 items-center gap-2">
        {/* 计时 + 任务 */}
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

        {/* 资讯 */}
        <div className="relative" ref={infoRef}>
          <button onClick={() => { setShowInfo(!showInfo); setShowTasks(false); }} className={cn(navBtn, 'relative')}>
            <Newspaper className="h-4 w-4" />
            资讯
            {unreadInfo > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white">
                {unreadInfo}
              </span>
            )}
          </button>
          {showInfo && (
            <div className="absolute right-0 top-full mt-1 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <span className="text-sm font-semibold text-foreground">消息资讯</span>
                <span className="text-xs text-muted-foreground">{unreadInfo} 条未读</span>
              </div>
              <div className="max-h-80 divide-y overflow-y-auto">
                {infoItems.map((item) => (
                  <div key={item.id} className={cn('flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent', !item.read && 'bg-blue-50/30 dark:bg-blue-950/30')}>
                    <div className="mt-0.5 shrink-0">{infoIcon(item.type)}</div>
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-[13px]', !item.read ? 'font-semibold text-foreground' : 'font-medium text-foreground/70')}>{item.title}</p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">{item.desc}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{item.time}</p>
                    </div>
                    {!item.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                  </div>
                ))}
              </div>
              <div className="border-t px-4 py-2">
                <button className="text-xs font-medium text-indigo-600 hover:text-indigo-700">查看全部消息 →</button>
              </div>
            </div>
          )}
        </div>

        {/* 待办 */}
        <div className="relative" ref={taskRef}>
          <button onClick={() => { setShowTasks(!showTasks); setShowInfo(false); }} className={cn(navBtn, 'relative')}>
            <Bell className="h-4 w-4" />
            待办
            {urgentCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {urgentCount}
              </span>
            )}
          </button>
          {showTasks && (
            <div className="absolute right-0 top-full mt-1 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <span className="text-sm font-semibold text-foreground">待办任务</span>
                <span className="text-xs text-muted-foreground">{quickTasks.length} 项</span>
              </div>
              {quickTasks.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  <CheckSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />暂无待办任务
                </div>
              ) : (
                <div className="max-h-72 divide-y divide-border overflow-y-auto">
                  {quickTasks.map((task) => (
                    <div key={task.id} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent">
                      <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', task.priority === 'URGENT' || task.priority === 'HIGH' ? 'bg-red-400' : task.priority === 'MEDIUM' ? 'bg-amber-400' : 'bg-slate-300')} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-foreground">{task.title}</p>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">{task.project.name}</p>
                      </div>
                      {task.dueDate && (
                        <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="h-3 w-3" />{new Date(task.dueDate).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  ))}
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
              <p className="text-[13px] font-medium text-foreground">{user?.name || '未登录'}</p>
              <p className="text-[11px] text-muted-foreground">{roleLabel}</p>
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
