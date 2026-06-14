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
  { icon: '•', label: '今日简报', text: '帮我做一份今日简报，列出待办、风险和建议动作。' },
  { icon: '!', label: '风险扫描', text: '有哪些延期任务，哪些订单成本接近报价上限？' },
  { icon: '→', label: '周计划', text: '按当前排期和优先级，帮我安排下周工作。' },
  { icon: '◆', label: '项目总览', text: '帮我做一个完整的项目分析报告，包括所有项目进度、成本和风险评估。' },
];

export function QuickActions({ onAction }: QuickActionsProps) {
  return (
    <div>
      <p className="mb-1.5 px-1 text-xs font-bold text-foreground/80">💡 快捷提问</p>
      <div className="space-y-0.5">
        {quickActions.map((action) => (
          <button
            key={action.text}
            type="button"
            onClick={() => onAction(action.text)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-foreground/70 transition-colors hover:bg-background hover:text-indigo-600 hover:shadow-sm"
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 text-2xs font-bold text-slate-500">{action.icon}</span>
            <span className="flex-1">{action.label}</span>
            <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
          </button>
        ))}
      </div>
    </div>
  );
}
