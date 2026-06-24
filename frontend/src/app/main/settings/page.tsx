'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Bot, Link, Shield, Database, Search, Mail, Send, Bell, Mic,
} from 'lucide-react';
import { AiConfigTab } from '@/components/features/settings/tabs/AiConfigTab';
import { SpeechConfigTab } from '@/components/features/settings/tabs/SpeechConfigTab';
import { SearchConfigTab } from '@/components/features/settings/tabs/SearchConfigTab';
import { IntegrationTab } from '@/components/features/settings/tabs/IntegrationTab';
import { EmailTab } from '@/components/features/settings/tabs/EmailTab';
import { PushTab } from '@/components/features/settings/tabs/PushTab';
import { SessionTab } from '@/components/features/settings/tabs/SessionTab';
import { DataTab } from '@/components/features/settings/tabs/DataTab';

type TabKey = 'ai' | 'stt' | 'search' | 'integration' | 'email' | 'push' | 'security' | 'data';

const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'ai', label: 'AI 配置', icon: Bot },
  { key: 'stt', label: '语音识别', icon: Mic },
  { key: 'search', label: '搜索配置', icon: Search },
  { key: 'integration', label: '集成管理', icon: Link },
  { key: 'email', label: '邮件设置', icon: Mail },
  { key: 'push', label: '推送管理', icon: Bell },
  { key: 'security', label: '安全设置', icon: Shield },
  { key: 'data', label: '数据管理', icon: Database },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('ai');

  return (
    <div className="mx-auto max-w-4xl page-enter">

      {/* 分类标签 */}
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1 scrollbar-none">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn('flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3.5 py-1.5 text-sm font-medium transition-all',
              activeTab === tab.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-accent')}>
            <tab.icon className="h-3.5 w-3.5" />{tab.label}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
        {activeTab === 'ai' && <AiConfigTab />}
        {activeTab === 'stt' && <SpeechConfigTab />}
        {activeTab === 'search' && <SearchConfigTab />}
        {activeTab === 'integration' && <IntegrationTab />}
        {activeTab === 'email' && <EmailTab />}
        {activeTab === 'push' && <PushTab />}
        {activeTab === 'security' && <SessionTab />}
        {activeTab === 'data' && <DataTab />}
      </div>
    </div>
  );
}
