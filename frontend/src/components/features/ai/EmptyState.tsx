'use client';

import { Zap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface EmptyStateProps {
  onPromptClick: (text: string) => void;
}

export function EmptyState({ onPromptClick }: EmptyStateProps) {
  const user = useAuth((s) => s.user);
  const hour = new Date().getHours();

  let greeting = '你好';
  if (hour >= 6 && hour < 12) greeting = '早上好';
  else if (hour >= 12 && hour < 14) greeting = '中午好';
  else if (hour >= 14 && hour < 18) greeting = '下午好';
  else if (hour >= 18 && hour < 22) greeting = '晚上好';

  const displayName = user?.name || '朋友';

  return (
    <div className="flex flex-col items-center px-4 py-14">
      {/* 头像 */}
      {user?.avatar ? (
        <img
          src={user.avatar}
          alt={user.name || ''}
          className="h-16 w-16 rounded-full object-cover ring-2 ring-indigo-100 shadow-sm"
        />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 ring-2 ring-indigo-100">
          <Zap className="h-8 w-8 text-indigo-500" aria-hidden="true" />
        </div>
      )}

      {/* 问候语 */}
      <p className="mt-4 text-[20px] font-bold text-slate-800">
        {greeting}，{displayName}
      </p>

      {/* 自我介绍 */}
      <p className="mt-2.5 text-[14px] text-slate-500 leading-relaxed text-center max-w-xs">
        我是你的 AI 工作助手 👋
      </p>
      <p className="mt-1 text-[13px] text-slate-500 leading-relaxed text-center max-w-xs">
        可以帮你查看项目进度、分析财务数据、
        <br />
        管理任务、跟进客户。
      </p>
      <p className="mt-3 text-[12px] text-slate-500">
        在下方输入你的问题，或点击快捷提问开始 👇
      </p>
    </div>
  );
}
