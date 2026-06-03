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
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

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
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  return (
    <aside className={cn(
      'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-card transition-all duration-300 ease-in-out',
      collapsed ? 'w-[72px]' : 'w-[272px]',
    )}>
      {/* Logo + 折叠按钮 */}
      <div className={cn(
        'flex h-16 shrink-0 items-center border-b border-border',
        collapsed ? 'justify-center px-2' : 'gap-3 px-5',
      )}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600">
          <span className="text-base font-bold text-white">T</span>
        </div>
        {!collapsed && (
          <div className="flex-1">
            <h1 className="text-base font-bold text-foreground">TaskFlow+</h1>
            <p className="text-[11px] text-muted-foreground">智能项目管理</p>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title={collapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* 导航 */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => {
          const isCollapsed = collapsed || collapsedGroups.has(group.label);
          return (
            <div key={group.label} className="mb-2">
              {/* 分组标题 */}
              {!collapsed && (
                <button
                  onClick={() => toggleGroup(group.label)}
                  aria-expanded={!collapsedGroups.has(group.label)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent"
                >
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 text-muted-foreground transition-transform',
                      collapsedGroups.has(group.label) && '-rotate-90',
                    )}
                  />
                </button>
              )}

              {/* 分组项 */}
              {!collapsedGroups.has(group.label) && (
                <div className={cn('mt-1 space-y-0.5', collapsed && 'px-0')}>
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
                          'flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150',
                          collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
                          isActive
                            ? 'border-l-[3px] border-l-indigo-500 bg-indigo-50 pl-[9px] text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400'
                            : 'border-l-[3px] border-l-transparent pl-[9px] text-muted-foreground hover:bg-accent hover:text-foreground',
                        )}
                      >
                        <item.icon className={cn(
                          'h-[18px] w-[18px] shrink-0',
                          isActive ? 'text-indigo-500 dark:text-indigo-400' : 'text-muted-foreground',
                        )} />
                        {!collapsed && item.label}
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
      <div className={cn('border-t border-border', collapsed ? 'p-2' : 'p-4')}>
        <button
          onClick={onOpenAi}
          title={collapsed ? 'AI 助手' : undefined}
          className={cn(
            'flex w-full items-center rounded-xl border border-indigo-100 bg-indigo-50/50 transition-all duration-200 hover:border-indigo-200 hover:bg-indigo-50 hover:shadow-sm dark:border-indigo-800/40 dark:bg-indigo-950/30 dark:hover:border-indigo-700/50 dark:hover:bg-indigo-950/50',
            collapsed ? 'justify-center px-2 py-3' : 'gap-3 px-4 py-3.5',
          )}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950/50">
            <Sparkles className="h-[18px] w-[18px] text-indigo-600 dark:text-indigo-400" />
          </div>
          {!collapsed && (
            <div>
              <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">
                AI 助手
              </p>
              <p className="text-[11px] text-indigo-400 dark:text-indigo-500">
                ⌘J 展开对话
              </p>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
