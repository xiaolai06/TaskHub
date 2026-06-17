'use client';

import { useState } from 'react';
import { Loader2, AlertTriangle, Target, Plus, Sparkles, LayoutList, Columns3, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useGoalList,
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
  useCalculateProgress,
  useProjectList,
  useCustomerList,
} from '@/hooks/useGoals';
import type { Goal, MetricCategory } from '@/hooks/useGoals';
import { GoalCard, METRIC_CATEGORIES } from '@/components/features/goals/GoalCard';
import { GoalForm } from '@/components/features/goals/GoalForm';
import { GoalFilter } from '@/components/features/goals/GoalFilter';
import { GoalBoard } from '@/components/features/goals/GoalBoard';

const categoryMetricMap: Record<MetricCategory, string[]> = Object.fromEntries(
  METRIC_CATEGORIES.map(c => [c.key, c.metrics])
) as Record<MetricCategory, string[]>;

export default function GoalsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: goals, isLoading, error } = useGoalList({
    status: statusFilter || undefined,
  });
  const { data: projects } = useProjectList();
  const { data: customers } = useCustomerList();

  const createMutation = useCreateGoal();
  const updateMutation = useUpdateGoal();
  const deleteMutation = useDeleteGoal();
  const calcMutation = useCalculateProgress();

  // 客户端筛选：搜索 + 日期 + 分类
  const goalList = (goals?.data || []).filter((g) => {
    if (search && !g.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (dateFrom && g.startDate < dateFrom) return false;
    if (dateTo && g.startDate > dateTo) return false;
    if (categoryFilter && !categoryMetricMap[categoryFilter as MetricCategory]?.includes(g.metricType)) return false;
    return true;
  });

  function handleCreate(input: unknown) {
    createMutation.mutate(input, {
      onSuccess: () => { setShowForm(false); toast.success('目标创建成功'); },
      onError: (err) => toast.error('创建失败：' + (err instanceof Error ? err.message : '请重试')),
    });
  }

  function handleUpdate(input: unknown) {
    if (!editGoal) return;
    updateMutation.mutate({ id: editGoal.id, data: input }, {
      onSuccess: () => { setShowForm(false); setEditGoal(null); toast.success('目标更新成功'); },
      onError: (err) => toast.error('更新失败：' + (err instanceof Error ? err.message : '请重试')),
    });
  }

  function handleDelete(id: string) {
    if (confirm('确定要删除这个目标吗？')) {
      deleteMutation.mutate(id, {
        onSuccess: () => toast.success('目标已删除'),
        onError: () => toast.error('删除失败'),
      });
    }
  }

  function handleCalculate(id: string) {
    calcMutation.mutate(id, {
      onSuccess: (res) => toast.success(res.message || '计算完成'),
      onError: () => toast.error('计算失败'),
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-3 page-enter">
      {/* 第一行：视图切换 + 搜索 + 新建 */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-0.5 rounded-lg border border-border/80 bg-card p-0.5 h-8">
          <button onClick={() => setViewMode('list')}
            className={cn('flex items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-all h-7',
              viewMode === 'list' ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-accent')}>
            <LayoutList className="h-3.5 w-3.5" />列表
          </button>
          <button onClick={() => setViewMode('board')}
            className={cn('flex items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-all h-7',
              viewMode === 'board' ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-accent')}>
            <Columns3 className="h-3.5 w-3.5" />看板
          </button>
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜索目标..."
            className="h-8 w-full rounded-lg border border-border/80 bg-card pl-8 pr-7 text-xs text-foreground/80 outline-none placeholder:text-muted-foreground/60 transition-all hover:border-indigo-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60" />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground/40 hover:bg-muted hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => { setEditGoal(null); setShowForm(true); }}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 active:scale-95">
            <Plus className="h-3.5 w-3.5" />新建目标
          </button>
        </div>
      </div>

      {/* 第二行：状态Tab + 分类 + 日期 */}
      <GoalFilter
        status={statusFilter} category={categoryFilter}
        dateFrom={dateFrom} dateTo={dateTo}
        onStatusChange={setStatusFilter}
        onCategoryChange={setCategoryFilter}
        onDateFromChange={setDateFrom} onDateToChange={setDateTo}
      />

      {/* 加载态 */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
        </div>
      )}

      {/* 错误态 */}
      {error && !isLoading && (
        <div className="flex flex-col items-center py-16">
          <AlertTriangle className="h-10 w-10 text-red-300" />
          <p className="mt-3 text-sm text-red-500">加载失败，请稍后重试</p>
        </div>
      )}

      {/* 空状态 */}
      {!isLoading && !error && goalList.length === 0 && (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border py-20">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50">
            <Target className="h-7 w-7 text-indigo-400" />
          </div>
          <p className="mt-4 text-sm font-medium text-foreground/80">还没有经营目标</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {statusFilter || categoryFilter || search || dateFrom || dateTo
              ? '没有符合条件的目标，试试调整筛选'
              : '设定第一个目标，追踪你的经营进度'}
          </p>
          {!statusFilter && !categoryFilter && !search && !dateFrom && !dateTo && (
            <button onClick={() => { setEditGoal(null); setShowForm(true); }}
              className="mt-4 flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              <Sparkles className="h-4 w-4" />创建第一个目标
            </button>
          )}
        </div>
      )}

      {/* 目标列表 / 看板 */}
      {!isLoading && !error && goalList.length > 0 && viewMode === 'list' && (
        <div className="space-y-3">
          {goalList.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={(g) => { setEditGoal(g); setShowForm(true); }}
              onDelete={handleDelete}
              onCalculate={handleCalculate}
            />
          ))}
        </div>
      )}

      {!isLoading && !error && viewMode === 'board' && (
        <GoalBoard
          goals={goalList}
          onEdit={(g) => { setEditGoal(g); setShowForm(true); }}
          onDelete={handleDelete}
          onCalculate={handleCalculate}
        />
      )}

      {/* 弹窗 */}
      <GoalForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditGoal(null); }}
        onSubmit={editGoal ? handleUpdate : handleCreate}
        isLoading={createMutation.isPending || updateMutation.isPending}
        editGoal={editGoal}
        projects={projects || []}
        customers={customers || []}
      />
    </div>
  );
}
