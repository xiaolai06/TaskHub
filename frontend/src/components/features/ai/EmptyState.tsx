'use client';

import { Sparkles } from 'lucide-react';
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
    <div className="flex h-full flex-col items-center justify-center px-8">
      {/* 小语头像 */}
      <div className="relative">
        {user?.avatar ? (
          <img
            src={user.avatar}
            alt={user.name || ''}
            className="h-16 w-16 rounded-full object-cover ring-2 ring-indigo-100 shadow-sm"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 ring-2 ring-indigo-100 shadow-md">
            <Sparkles className="h-8 w-8 text-indigo-500" aria-hidden="true" />
          </div>
        )}
        <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-2xs text-white ring-2 ring-card">
          ✦
        </span>
      </div>

      {/* 问候语 */}
      <p className="mt-5 text-xl font-bold tracking-tight text-foreground">
        {greeting}，{displayName}！
      </p>

      {/* 小语自我介绍 */}
      <p className="mt-2 text-base font-semibold text-indigo-600">
        我是小语 👋
      </p>
      <p className="mt-2 max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
        你的 AI 工作搭档，可以帮你查看项目进度、分析财务数据、管理任务、跟进客户。
      </p>

      {/* 快捷提问入口 */}
      <div className="mt-10 grid w-full max-w-md grid-cols-2 gap-2.5">
        {[
          { icon: '📋', text: '今日简报', prompt: '帮我做一份今日简报，列出待办、风险和建议动作。' },
          { icon: '📊', text: '项目进度', prompt: '帮我看看当前项目的整体进度。' },
          { icon: '⚠️', text: '风险扫描', prompt: '有哪些延期任务，哪些订单成本接近报价上限？' },
          { icon: '👤', text: '客户分析', prompt: '帮我分析一下客户情况，哪些需要优先跟进？' },
        ].map((item) => (
          <button
            key={item.text}
            onClick={() => onPromptClick(item.prompt)}
            className="flex items-center gap-2.5 rounded-2xl border border-border/50 bg-card/80 px-4 py-3 text-left text-sm text-foreground/70 transition-all hover:border-indigo-200 hover:bg-indigo-50/30 hover:text-indigo-600 hover:shadow-sm"
          >
            <span className="text-base">{item.icon}</span>
            <span className="font-medium">{item.text}</span>
          </button>
        ))}
      </div>

      <p className="mt-8 text-2xs-plus text-muted-foreground/40">
        或者直接输入你的问题，小语随时待命 ✨
      </p>
    </div>
  );
}
