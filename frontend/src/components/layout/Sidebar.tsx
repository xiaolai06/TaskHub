'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  BarChart3,
  Search,
  Settings,
  Target,
} from 'lucide-react';

const navItems = [
  { href: '/main/dashboard', label: '仪表盘', icon: LayoutDashboard },
  { href: '/main/projects', label: '项目', icon: FolderKanban },
  { href: '/main/customers', label: '客户', icon: Users },
  { href: '/main/goals', label: '目标', icon: Target },
  { href: '/main/reports', label: '报表', icon: BarChart3 },
  { href: '/main/research', label: '研究', icon: Search },
  { href: '/main/settings', label: '设置', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-[268px] border-r bg-white">
      <div className="flex h-14 items-center border-b px-5">
        <h1 className="text-lg font-bold text-indigo-600">TaskFlow+</h1>
      </div>
      <nav className="space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
