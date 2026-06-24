'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback } from 'react';
import { TrendingUp, FolderKanban, CheckSquare, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DateFilter, createDefaultDateFilter } from '@/components/features/reports/DateFilter';
import type { DateFilterValue } from '@/components/features/reports/DateFilter';

const FinanceTab = dynamic(() => import('@/components/features/reports/FinanceTab').then(m => m.FinanceTab), { ssr: false });
const ProjectTab = dynamic(() => import('@/components/features/reports/ProjectTab').then(m => m.ProjectTab), { ssr: false });
const TaskTab = dynamic(() => import('@/components/features/reports/TaskTab').then(m => m.TaskTab), { ssr: false });
const CustomerTab = dynamic(() => import('@/components/features/reports/CustomerTab').then(m => m.CustomerTab), { ssr: false });

const TABS = [
  { key: 'finance', label: '财务总览', icon: TrendingUp },
  { key: 'project', label: '项目分析', icon: FolderKanban },
  { key: 'task', label: '任务效率', icon: CheckSquare },
  { key: 'customer', label: '客户洞察', icon: Users },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('finance');
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(createDefaultDateFilter);

  const handleDateChange = useCallback((v: DateFilterValue) => {
    setDateFilter(v);
  }, []);

  return (
    <div className="flex flex-col gap-5 page-enter">
      {/* ── 顶部栏：Tab + 日期筛选 ── */}
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'relative flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:bg-accent',
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <DateFilter value={dateFilter} onChange={handleDateChange} />
        </div>
      </div>

      {/* ── Tab 内容 ── */}
      {activeTab === 'finance' && <FinanceTab dateFilter={dateFilter} />}
      {activeTab === 'project' && <ProjectTab dateFilter={dateFilter} />}
      {activeTab === 'task' && <TaskTab dateFilter={dateFilter} />}
      {activeTab === 'customer' && <CustomerTab dateFilter={dateFilter} />}
    </div>
  );
}
