'use client';

import { Brain, Users, Clock, Calendar, FolderKanban, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatSession } from '@/hooks/useAiChat';
import { SmartDigest } from './SmartDigest';
import { QuickActions } from './QuickActions';
import { ProjectMiniList } from './ProjectMiniList';
import { CustomerTab } from './CustomerTab';
import { HistoryTab } from './HistoryTab';
import { ModelSwitcher } from './ModelSwitcher';
import { ScheduleQuickActions } from './ScheduleQuickActions';
import { JobConfigPanel } from './JobConfigPanel';

type TabKey = 'overview' | 'projects' | 'customers' | 'schedule' | 'history' | 'jobs';

interface AiSidebarProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onQuickAction: (text: string) => void;
  onCustomerClick: (name: string) => void;
  onDigestClick: () => void;
  projects: Array<{ id: string; name: string; status: string; budget?: number; startDate?: string }>;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSwitchSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onNewSession: () => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onPinSession: (sessionId: string, isPinned: boolean) => void;
  selectedModel?: string;
  selectedModelName?: string;
  onModelSelect: (modelId: string | undefined, provider?: string, modelName?: string) => void;
  open: boolean;
}

const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'overview', label: '概览', icon: Brain },
  { key: 'projects', label: '项目', icon: FolderKanban },
  { key: 'customers', label: '客户', icon: Users },
  { key: 'schedule', label: '排期', icon: Calendar },
  { key: 'jobs', label: '定时', icon: Zap },
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
  onRenameSession,
  onPinSession,
  selectedModel,
  selectedModelName,
  onModelSelect,
  open,
}: AiSidebarProps) {
  return (
    <div className="flex h-full w-[270px] shrink-0 bg-muted/30">
      {/* ── 竖向 Tab 列 ── */}
      <div className="flex w-[46px] shrink-0 flex-col items-center gap-1.5 border-r border-border/15 py-3">
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              title={tab.label}
              className={cn(
                'group relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-150',
                active
                  ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                  : 'text-muted-foreground/60 hover:bg-accent hover:text-foreground',
              )}
            >
              <tab.icon className={cn('h-[16px] w-[16px]', active ? 'stroke-[2.2]' : 'stroke-[1.8]')} />
              <span className="pointer-events-none absolute left-full z-10 ml-2.5 whitespace-nowrap rounded-lg bg-foreground/90 px-2.5 py-1 text-2xs-plus font-medium text-card opacity-0 shadow-lg backdrop-blur-sm transition-opacity group-hover:opacity-100">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Tab 内容 ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto p-3">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <SmartDigest onDigestClick={onDigestClick} open={open} />
              <QuickActions onAction={onQuickAction} />
            </div>
          )}

          {activeTab === 'projects' && (
            <ProjectMiniList projects={projects} defaultOpen onQuickAction={onQuickAction} />
          )}

          {activeTab === 'customers' && (
            <CustomerTab onCustomerClick={onCustomerClick} open={open} />
          )}

          {activeTab === 'schedule' && (
            <ScheduleQuickActions onAction={onQuickAction} />
          )}

          {activeTab === 'jobs' && (
            <div>
              <p className="mb-3 px-1 text-xs font-bold text-foreground/80">⚡ 定时任务</p>
              <JobConfigPanel />
            </div>
          )}

          {activeTab === 'history' && (
            <HistoryTab
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSwitchSession={onSwitchSession}
              onDeleteSession={onDeleteSession}
              onNewSession={onNewSession}
              onRenameSession={onRenameSession}
              onPinSession={onPinSession}
            />
          )}
        </div>

        {/* 模型切换器 */}
        <ModelSwitcher selectedModel={selectedModel} selectedModelName={selectedModelName} onSelect={onModelSelect} open={open} />
      </div>
    </div>
  );
}
