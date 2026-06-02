'use client';

import { Brain, Users, Clock, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SmartDigest } from './SmartDigest';
import { QuickActions } from './QuickActions';
import { ProjectMiniList } from './ProjectMiniList';
import { CustomerTab } from './CustomerTab';
import { HistoryTab } from './HistoryTab';
import { ModelSwitcher } from './ModelSwitcher';
import { ScheduleQuickActions } from './ScheduleQuickActions';

type TabKey = 'overview' | 'customers' | 'history' | 'schedule';

interface AiSidebarProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onQuickAction: (text: string) => void;
  onCustomerClick: (name: string) => void;
  onDigestClick: () => void;

  // 项目数据
  projects: Array<{ id: string; name: string; status: string; budget?: number; startDate?: string }>;

  // 会话数据
  sessions: Array<{ sessionId: string; messageCount: number; lastMessage: Date; title?: string }>;
  activeSessionId: string;
  onSwitchSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onNewSession: () => void;

  // 模型
  selectedModel?: string;
  onModelSelect: (modelId: string | undefined) => void;

  open: boolean;
}

const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'overview', label: '概览', icon: Brain },
  { key: 'customers', label: '客户', icon: Users },
  { key: 'schedule', label: '排期', icon: Calendar },
  { key: 'history', label: '历史', icon: Clock },
];

export function AiSidebar({
  activeTab,
  onTabChange,
  onQuickAction,
  onCustomerClick,
  onDigestClick,
  projects,
  sessions,
  activeSessionId,
  onSwitchSession,
  onDeleteSession,
  onNewSession,
  selectedModel,
  onModelSelect,
  open,
}: AiSidebarProps) {
  return (
    <div className="flex h-full w-[320px] shrink-0 flex-col border-r bg-muted/40">
      {/* Tab 切换 */}
      <div className="flex border-b px-2 pt-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={cn(
              'flex items-center gap-1.5 rounded-t-md px-3 py-2 text-[12px] font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-background text-indigo-600 shadow-sm'
                : 'text-muted-foreground hover:text-slate-600',
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 内容 */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'overview' && (
          <div className="space-y-3">
            <SmartDigest onDigestClick={onDigestClick} open={open} />
            <QuickActions onAction={onQuickAction} />
            <div className="border-t border-slate-200/60 pt-3">
              <ProjectMiniList projects={projects} />
            </div>
          </div>
        )}

        {activeTab === 'customers' && (
          <CustomerTab onCustomerClick={onCustomerClick} open={open} />
        )}

        {activeTab === 'schedule' && (
          <ScheduleQuickActions onAction={onQuickAction} />
        )}

        {activeTab === 'history' && (
          <HistoryTab
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSwitchSession={onSwitchSession}
            onDeleteSession={onDeleteSession}
            onNewSession={onNewSession}
          />
        )}
      </div>

      {/* 模型切换器 */}
      <ModelSwitcher selectedModel={selectedModel} onSelect={onModelSelect} />
    </div>
  );
}
