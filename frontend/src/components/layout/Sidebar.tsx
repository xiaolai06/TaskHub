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
      { href: '/main/projects/detail/schedule', label: '排期视图', icon: Calendar },
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
      { href: '/main/reports', label: '报表分析', icon: BarChart3 },
      { href: '/main/research', label: '业务研究', icon: Search },
    ],
  },
  {
    label: '设置',
    items: [
      { href: '/main/settings', label: '系统设置', icon: Settings },
    ],
  },
];

export function Sidebar({ onOpenAi }: { onOpenAi?: () => void }) {
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
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[272px] flex-col border-r border-slate-200 bg-white">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-100 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600">
          <span className="text-base font-bold text-white">T</span>
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900">TaskFlow+</h1>
          <p className="text-[11px] text-slate-400">智能项目管理</p>
        </div>
      </div>

      {/* 导航 */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => {
          const isCollapsed = collapsedGroups.has(group.label);
          return (
            <div key={group.label} className="mb-2">
              {/* 分组标题 */}
              <button
                onClick={() => toggleGroup(group.label)}
                aria-expanded={!isCollapsed}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50"
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {group.label}
                </span>
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 text-slate-400 transition-transform',
                    isCollapsed && '-rotate-90',
                  )}
                />
              </button>

              {/* 分组项 */}
              {!isCollapsed && (
                <div className="mt-1 space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = item.href === '/main/dashboard'
                      ? pathname === '/main/dashboard'
                      : pathname.startsWith(item.href) && item.href !== '/main/dashboard';

                    return (
                      <Link
                        key={item.href + item.label}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                          isActive
                            ? 'border-l-[3px] border-l-indigo-500 bg-indigo-50 pl-[9px] text-indigo-600'
                            : 'border-l-[3px] border-l-transparent pl-[9px] text-slate-500 hover:bg-slate-50 hover:text-slate-900',
                        )}
                      >
                        <item.icon className={cn(
                          'h-[18px] w-[18px] shrink-0',
                          isActive ? 'text-indigo-500' : 'text-slate-400',
                        )} />
                        {item.label}
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
      <div className="border-t border-slate-100 p-4">
        <button
          onClick={onOpenAi}
          className="flex w-full items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3.5 text-left transition-all duration-200 hover:border-indigo-200 hover:bg-indigo-50 hover:shadow-sm"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100">
            <Sparkles className="h-[18px] w-[18px] text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-indigo-700">
              AI 助手
            </p>
            <p className="text-[11px] text-indigo-400">
              ⌘J 展开对话
            </p>
          </div>
        </button>
      </div>
    </aside>
  );
}
