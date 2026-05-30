'use client';

import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogOut, User } from 'lucide-react';

export function Header() {
  const { user, logout } = useAuth();

  const initials = user?.name
    ? user.name.slice(0, 2).toUpperCase()
    : 'U';

  return (
    <header className="fixed left-[268px] right-0 top-0 z-30 flex h-14 items-center justify-between border-b bg-white px-6">
      <div />
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">
          {user?.name || '未登录'}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              个人信息
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => logout()}>
              <LogOut className="mr-2 h-4 w-4" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
