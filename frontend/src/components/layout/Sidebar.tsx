'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  BarChart3,
  Search,
  Settings,
  Target,
  Calendar,
  Sparkles,
  ChevronDown,
  PanelLeftClose,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface NavGroup {
  label: string;
  items: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
}

const navGroups: NavGroup[] = [
  {
    label: '概览',
    items: [
      { href: '/main/dashboard', label: '仪表盘', icon: LayoutDashboard },
    ],
  },
  {
    label: '工作',
    items: [
      { href: '/main/projects', label: '项目管理', icon: FolderKanban },
      { href: '/main/tasks', label: '任务看板', icon: CheckSquare },
      { href: '/main/customers', label: '客户管理', icon: Users },
      { href: '/main/goals', label: '目标管理', icon: Target },
      { href: '/main/schedule', label: '排期视图', icon: Calendar },
    ],
  },
  {
    label: 'AI',
    items: [
      { href: '/main/ai', label: 'AI 工作台', icon: Sparkles },
    ],
  },
  {
    label: '洞察',
    items: [
      { href: '/main/reports', label: '经营看板', icon: BarChart3 },
      { href: '/main/research', label: '行业洞察', icon: Search },
    ],
  },
  {
    label: '设置',
    items: [
      { href: '/main/settings', label: '系统设置', icon: Settings },
    ],
  },
];

interface SidebarProps {
  onOpenAi?: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ onOpenAi, collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  function toggleGroup(label: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  return (
    <aside className={cn(
      'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-card transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
      collapsed ? 'w-[68px]' : 'w-[260px]',
    )}>
      {/* Logo — 点击切换收起/展开 */}
      <button
        onClick={onToggleCollapse}
        className={cn(
          'flex h-14 shrink-0 items-center border-b border-border transition-all duration-300 hover:bg-accent/50',
          collapsed ? 'justify-center px-2' : 'gap-3 px-4',
        )}
        title={collapsed ? '展开侧边栏' : '收起侧边栏'}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm shadow-indigo-500/20">
          <span className="text-sm font-bold text-white">T</span>
        </div>
        <div className={cn(
          'flex flex-col overflow-hidden transition-all duration-300',
          collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100',
        )}>
          <span className="text-sm font-bold text-foreground whitespace-nowrap leading-tight">智汇轻营</span>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap leading-tight">TaskHub</span>
        </div>
        {/* 展开时显示收起按钮 */}
        {!collapsed && (
          <div className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <PanelLeftClose className="h-4 w-4" />
          </div>
        )}
      </button>

      {/* 导航 */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        {navGroups.map((group) => {
          const isGroupHidden = collapsed || collapsedGroups.has(group.label);
          return (
            <div key={group.label} className="mb-1.5">
              {/* 分组标题 */}
              {!collapsed && (
                <button
                  onClick={() => toggleGroup(group.label)}
                  aria-expanded={!collapsedGroups.has(group.label)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left transition-colors hover:bg-accent/50"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {group.label}
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-3 w-3 text-muted-foreground/50 transition-transform duration-200',
                      collapsedGroups.has(group.label) && '-rotate-90',
                    )}
                  />
                </button>
              )}

              {/* 分组项 */}
              {!collapsedGroups.has(group.label) && (
                <div className={cn('mt-0.5', collapsed ? 'space-y-1.5' : 'space-y-0.5')}>
                  {group.items.map((item) => {
                    const isActive = item.href === '/main/dashboard'
                      ? pathname === '/main/dashboard'
                      : pathname.startsWith(item.href) && item.href !== '/main/dashboard';

                    return (
                      <Link
                        key={item.href + item.label}
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          'group relative flex items-center rounded-lg text-[13px] font-medium transition-all duration-200',
                          collapsed ? 'justify-center h-10 w-10 mx-auto' : 'gap-2.5 px-3 py-2',
                          isActive
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                            : 'text-foreground/60 hover:bg-accent hover:text-foreground',
                        )}
                      >
                        {/* 活跃指示条 */}
                        {isActive && (
                          <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-indigo-500" />
                        )}
                        <item.icon className={cn(
                          'h-[18px] w-[18px] shrink-0 transition-colors duration-200',
                          isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground group-hover:text-foreground',
                        )} />
                        <span className={cn(
                          'overflow-hidden whitespace-nowrap transition-all duration-300',
                          collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100',
                        )}>
                          {item.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* 底部 AI 入口 */}
      <div className={cn('border-t border-border', collapsed ? 'p-2' : 'p-3')}>
        <button
          onClick={onOpenAi}
          title={collapsed ? 'AI 助手' : undefined}
          className={cn(
            'flex w-full items-center rounded-xl border border-indigo-100 bg-indigo-50/50 transition-all duration-200 hover:border-indigo-200 hover:bg-indigo-50 hover:shadow-sm dark:border-indigo-800/40 dark:bg-indigo-950/30 dark:hover:border-indigo-700/50 dark:hover:bg-indigo-950/50',
            collapsed ? 'justify-center h-10 w-10 mx-auto' : 'gap-2.5 px-3.5 py-2.5',
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950/50">
            <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className={cn(
            'overflow-hidden transition-all duration-300',
            collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100',
          )}>
            <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-400 whitespace-nowrap">AI 助手</p>
            <p className="text-[11px] text-indigo-400 dark:text-indigo-500 whitespace-nowrap">⌘J 展开对话</p>
          </div>
        </button>
      </div>
    </aside>
  );
}
