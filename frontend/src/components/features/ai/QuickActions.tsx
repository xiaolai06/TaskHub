'use client';

import { ChevronRight } from 'lucide-react';

interface QuickAction {
  icon: string;
  label: string;
  text: string;
}

interface QuickActionsProps {
  onAction: (text: string) => void;
}

const quickActions: QuickAction[] = [
  { icon: '🌅', label: '今日简报', text: '帮我做一个今日简报' },
  { icon: '⚠️', label: '风险扫描', text: '有什么延期的任务和超预算的项目？' },
  { icon: '📅', label: '周计划', text: '帮我安排下周的工作' },
];

export function QuickActions({ onAction }: QuickActionsProps) {
  return (
    <div className="space-y-0.5">
      <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">快捷提问</p>
      {quickActions.map((action) => (
        <button
          key={action.text}
          onClick={() => onAction(action.text)}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[12px] text-slate-600 transition-colors hover:bg-white hover:text-indigo-600 hover:shadow-sm"
        >
          <span className="text-sm">{action.icon}</span>
          <span className="flex-1">{action.label}</span>
          <ChevronRight className="h-3 w-3 text-slate-300" />
        </button>
      ))}
    </div>
  );
}
