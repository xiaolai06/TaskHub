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
  BellRing,
  Sparkles,
  PanelLeftClose,
  Wallet,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  darkColor: string;
  activeBg: string;
  darkActiveBg: string;
  activeText: string;
  darkActiveText: string;
}

const navItems: NavItem[] = [
  { href: '/main/dashboard', label: '仪表盘', icon: LayoutDashboard, color: 'text-blue-600', darkColor: 'dark:text-blue-400', activeBg: 'bg-blue-50', darkActiveBg: 'dark:bg-blue-950/50', activeText: 'text-blue-700', darkActiveText: 'dark:text-blue-300' },
  { href: '/main/projects', label: '项目管理', icon: FolderKanban, color: 'text-violet-600', darkColor: 'dark:text-violet-400', activeBg: 'bg-violet-50', darkActiveBg: 'dark:bg-violet-950/50', activeText: 'text-violet-700', darkActiveText: 'dark:text-violet-300' },
  { href: '/main/tasks', label: '任务中心', icon: CheckSquare, color: 'text-cyan-600', darkColor: 'dark:text-cyan-400', activeBg: 'bg-cyan-50', darkActiveBg: 'dark:bg-cyan-950/50', activeText: 'text-cyan-700', darkActiveText: 'dark:text-cyan-300' },
  { href: '/main/customers', label: '客户管理', icon: Users, color: 'text-emerald-600', darkColor: 'dark:text-emerald-400', activeBg: 'bg-emerald-50', darkActiveBg: 'dark:bg-emerald-950/50', activeText: 'text-emerald-700', darkActiveText: 'dark:text-emerald-300' },
  { href: '/main/finance', label: '记账中心', icon: Wallet, color: 'text-teal-600', darkColor: 'dark:text-teal-400', activeBg: 'bg-teal-50', darkActiveBg: 'dark:bg-teal-950/50', activeText: 'text-teal-700', darkActiveText: 'dark:text-teal-300' },
  { href: '/main/goals', label: '目标管理', icon: Target, color: 'text-amber-600', darkColor: 'dark:text-amber-400', activeBg: 'bg-amber-50', darkActiveBg: 'dark:bg-amber-950/50', activeText: 'text-amber-700', darkActiveText: 'dark:text-amber-300' },
  { href: '/main/ai', label: '信息中心', icon: BellRing, color: 'text-rose-600', darkColor: 'dark:text-rose-400', activeBg: 'bg-rose-50', darkActiveBg: 'dark:bg-rose-950/50', activeText: 'text-rose-700', darkActiveText: 'dark:text-rose-300' },
  { href: '/main/reports', label: '经营看板', icon: BarChart3, color: 'text-teal-600', darkColor: 'dark:text-teal-400', activeBg: 'bg-teal-50', darkActiveBg: 'dark:bg-teal-950/50', activeText: 'text-teal-700', darkActiveText: 'dark:text-teal-300' },
  { href: '/main/research', label: '行业洞察', icon: Search, color: 'text-orange-600', darkColor: 'dark:text-orange-400', activeBg: 'bg-orange-50', darkActiveBg: 'dark:bg-orange-950/50', activeText: 'text-orange-700', darkActiveText: 'dark:text-orange-300' },
  { href: '/main/settings', label: '系统设置', icon: Settings, color: 'text-slate-500', darkColor: 'dark:text-slate-400', activeBg: 'bg-slate-100', darkActiveBg: 'dark:bg-slate-800/50', activeText: 'text-slate-700', darkActiveText: 'dark:text-slate-300' },
];

interface SidebarProps {
  onOpenAi?: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  isMobile?: boolean;
  mobileOpen?: boolean;
  onNavClick?: () => void;
}

export function Sidebar({ onOpenAi, collapsed, onToggleCollapse, isMobile, mobileOpen, onNavClick }: SidebarProps) {
  const pathname = usePathname();

  // 手机端：隐藏时完全不渲染
  if (isMobile && !mobileOpen) return null;

  return (
    <aside className={cn(
      'flex h-screen flex-col border-r border-border bg-card transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
      // 手机端：固定定位 + overlay，展开宽度 260px
      isMobile
        ? 'fixed inset-y-0 left-0 z-[50] w-[260px] shadow-2xl'
        : cn('fixed left-0 top-0 z-40', collapsed ? 'w-[66px]' : 'w-[210px]'),
    )}>
      {/* Logo */}
      <button
        onClick={onToggleCollapse}
        className={cn(
          'flex shrink-0 items-center border-b border-border transition-all duration-300 hover:bg-accent/50',
          (isMobile || !collapsed) ? 'h-14 gap-3 px-4' : 'h-14 justify-center px-2',
        )}
        title={isMobile ? '关闭菜单' : collapsed ? '展开侧边栏' : '收起侧边栏'}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/20">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z" />
            <path d="M12 12L20 7.5" />
            <path d="M12 12V21" />
            <path d="M12 12L4 7.5" />
            <circle cx="12" cy="12" r="2" fill="white" stroke="none" />
          </svg>
        </div>
        <div className={cn(
          'flex flex-col items-start justify-center overflow-hidden transition-all duration-300',
          (isMobile || !collapsed) ? 'w-auto opacity-100' : 'w-0 opacity-0',
        )}>
          <span className="text-base font-extrabold text-foreground whitespace-nowrap leading-none tracking-tight">智汇轻营</span>
          <span className="mt-0.5 text-2xs-plus font-medium text-muted-foreground/70 whitespace-nowrap leading-none tracking-wide">TaskHub</span>
        </div>
        {/* 手机端显示关闭按钮，桌面端显示收起按钮 */}
        {isMobile ? (
          <div className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <X className="h-4 w-4" />
          </div>
        ) : !collapsed ? (
          <div className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <PanelLeftClose className="h-4 w-4" />
          </div>
        ) : null}
      </button>

      {/* 导航 */}
      <nav className={cn('flex-1 overflow-y-auto px-2', (isMobile || !collapsed) ? 'space-y-2 py-3' : 'space-y-2 py-3')}>
        {navItems.map((item) => {
          const isActive = item.href === '/main/dashboard'
            ? pathname === '/main/dashboard'
            : pathname.startsWith(item.href) && item.href !== '/main/dashboard';

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              title={!isMobile && collapsed ? item.label : undefined}
              className={cn(
                'group relative flex items-center rounded-lg text-sm font-medium transition-all duration-200',
                (!isMobile && collapsed) ? 'justify-center h-9 w-9 mx-auto' : 'gap-2.5 px-3 py-2',
                isActive
                  ? cn(item.activeBg, item.activeText, item.darkActiveBg, item.darkActiveText)
                  : 'text-foreground/60 hover:bg-accent hover:text-foreground',
              )}
            >
              {isActive && (
                <div className={cn('absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full', item.color)} />
              )}
              <item.icon className={cn(
                'h-[18px] w-[18px] shrink-0 transition-colors duration-200',
                isActive ? cn(item.color, item.darkColor) : 'text-muted-foreground group-hover:text-foreground',
              )} />
              <span className={cn(
                'overflow-hidden whitespace-nowrap transition-all duration-300',
                (!isMobile && collapsed) ? 'w-0 opacity-0' : 'w-auto opacity-100',
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* 底部 AI 入口 */}
      <div className={cn('shrink-0 border-t border-border', (!isMobile && collapsed) ? 'px-2 py-3' : 'px-3 py-3')}>
        <button
          onClick={() => { onOpenAi?.(); onNavClick?.(); }}
          title={!isMobile && collapsed ? 'AI 助手' : undefined}
          className={cn(
            'flex w-full items-center rounded-lg bg-indigo-500/10 text-indigo-600 transition-all duration-200 hover:bg-indigo-500/15 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20',
            (!isMobile && collapsed) ? 'justify-center h-9 w-9 mx-auto' : 'gap-2.5 px-3 py-2',
          )}
        >
          <Sparkles className="h-[18px] w-[18px] shrink-0" />
          <span className={cn(
            'overflow-hidden whitespace-nowrap text-sm font-semibold transition-all duration-300',
            (!isMobile && collapsed) ? 'w-0 opacity-0' : 'w-auto opacity-100',
          )}>
            AI 助手
          </span>
        </button>
      </div>
    </aside>
  );
}
