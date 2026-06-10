'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface DigestData {
  taskCount: number;
  overdueCount: number;
  monthlyRevenue: number;
  monthlyProfit: number;
  profitMargin: number;
  followUpCount: number;
  urgentFollowUpCount: number;
}

interface SmartDigestProps {
  onDigestClick: () => void;
  open: boolean;
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-2.5 p-3">
      <div className="h-3 w-16 rounded bg-accent" />
      <div className="h-8 w-full rounded-lg bg-muted" />
      <div className="h-8 w-full rounded-lg bg-muted" />
      <div className="h-8 w-full rounded-lg bg-muted" />
    </div>
  );
}

export function SmartDigest({ onDigestClick, open }: SmartDigestProps) {
  const [data, setData] = useState<DigestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(false);

    // 从仪表盘和客户 API 获取数据（任务统计由后端聚合）
    Promise.all([
      api.get<any>('/dashboard/summary').catch(() => null),
      api.get<any>('/tasks/stats').catch(() => null),
      api.get<any[]>('/customers').catch(() => []),
    ])
      .then(([dashSummary, taskStats, customers]) => {
        const custArr = Array.isArray(customers) ? customers : (customers as any)?.data || [];

        const overdueCount = taskStats?.overdueCount || 0;
        const todoCount = taskStats?.todoCount || 0;

        // 从仪表盘数据中提取真实财务数据
        const revenue = (dashSummary?.monthIncome || dashSummary?.income || 0) / 100;
        const expense = (dashSummary?.monthExpense || dashSummary?.expense || 0) / 100;
        const profit = revenue - expense;
        const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

        setData({
          taskCount: todoCount,
          overdueCount,
          monthlyRevenue: Math.round(revenue),
          monthlyProfit: Math.round(profit),
          profitMargin: margin,
          followUpCount: custArr.length,
          urgentFollowUpCount: 0,
        });
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, [open]);

  if (loading) return <Skeleton />;
  if (error || !data) return null;

  return (
    <button
      onClick={onDigestClick}
      className="w-full rounded-xl border border-border bg-background p-3 text-left shadow-sm transition-all hover:border-indigo-200 hover:shadow-md"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">📅 今日数据</p>

      <div className="mt-2.5 space-y-2">
        {/* 待办 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">🎯</span>
            <span className="text-[12px] text-foreground/70">待办任务</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-foreground">{data.taskCount} 项</span>
            {data.overdueCount > 0 && (
              <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
                {data.overdueCount} 逾期
              </span>
            )}
          </div>
        </div>

        {/* 收入 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">💰</span>
            <span className="text-[12px] text-foreground/70">本月收入</span>
          </div>
          <span className="text-sm font-bold text-foreground">
            ¥{data.monthlyRevenue.toLocaleString()}
            {data.profitMargin > 0 && (
              <span className="ml-1 text-[10px] font-normal text-emerald-600">+{data.profitMargin}%</span>
            )}
          </span>
        </div>

        {/* 待跟进 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">👤</span>
            <span className="text-[12px] text-foreground/70">客户总数</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-foreground">{data.followUpCount} 个</span>
            {data.urgentFollowUpCount > 0 && (
              <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
                {data.urgentFollowUpCount} 紧急
              </span>
            )}
          </div>
        </div>
      </div>

      <p className="mt-2.5 text-[10px] text-muted-foreground">点击查看今日简报 →</p>
    </button>
  );
}
