'use client';

import { Calendar, AlertTriangle, TrendingUp, Clock, Zap } from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';

interface ScheduleQuickActionsProps {
  onAction: (text: string) => void;
}

const scheduleActions = [
  {
    id: 'overdue',
    label: '延期任务',
    description: '查看哪些任务已延期',
    icon: AlertTriangle,
    color: 'text-red-500',
    prompt: '有什么延期的任务？',
  },
  {
    id: 'today-focus',
    label: '今日焦点',
    description: '今天应该先做什么',
    icon: Zap,
    color: 'text-yellow-500',
    prompt: '今天的工作焦点是什么？先做哪个？',
  },
  {
    id: 'schedule-health',
    label: '排期健康度',
    description: '检测排期问题和冲突',
    icon: TrendingUp,
    color: 'text-green-500',
    prompt: '帮我检查一下排期健康度，有没有延期或冲突？',
  },
  {
    id: 'insert-eval',
    label: '插单评估',
    description: '评估新任务对排期的影响',
    icon: Calendar,
    color: 'text-blue-500',
    prompt: '我想接一个新项目，会影响现有排期吗？',
  },
  {
    id: 'time-available',
    label: '什么时候有空',
    description: '查看空闲时间段',
    icon: Clock,
    color: 'text-purple-500',
    prompt: '我什么时候有空？最近一周的排期情况怎么样？',
  },
];

export function ScheduleQuickActions({ onAction }: ScheduleQuickActionsProps) {
  return (
    <CollapsibleSection title="排期操作" defaultOpen={false}>
      {scheduleActions.map((action) => (
        <button
          key={action.id}
          onClick={() => onAction(action.prompt)}
          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 hover:scale-[1.02] transition-all duration-200 text-left focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
        >
          <action.icon className={`w-4 h-4 ${action.color}`} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{action.label}</div>
            <div className="text-xs text-muted-foreground truncate">{action.description}</div>
          </div>
        </button>
      ))}
    </CollapsibleSection>
  );
}
