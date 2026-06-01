'use client';

import { useState } from 'react';
import { Loader2, AlertTriangle, Target, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  useGoalList,
  useGoalOverview,
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
  useProjectList,
  useCustomerList,
} from '@/hooks/useGoals';
import type { Goal } from '@/hooks/useGoals';
import { GoalCard } from '@/components/features/goals/GoalCard';
import { GoalForm } from '@/components/features/goals/GoalForm';
import { GoalFilter } from '@/components/features/goals/GoalFilter';
import { GoalOverview } from '@/components/features/goals/GoalOverview';

export default function GoalsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const { data: goals, isLoading, error } = useGoalList({
    status: statusFilter || undefined,
    type: typeFilter || undefined,
  });
  const { data: overview } = useGoalOverview();
  const { data: projects } = useProjectList();
  const { data: customers } = useCustomerList();

  const createMutation = useCreateGoal();
  const updateMutation = useUpdateGoal();
  const deleteMutation = useDeleteGoal();

  const goalList = goals || [];

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

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <GoalOverview data={overview} isLoading={false} />
        <button
          onClick={() => { setEditGoal(null); setShowForm(true); }}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700 active:scale-95"
        >
          <Plus className="h-4 w-4" />新建目标
        </button>
      </div>

      {/* 筛选 + 列表 */}
      <div className="mt-4 space-y-3">
        {/* 筛选栏 */}
        <GoalFilter
          status={statusFilter} type={typeFilter}
          onStatusChange={setStatusFilter} onTypeChange={setTypeFilter}
        />

        {/* 加载态 */}
        {isLoading && (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-indigo-400" /></div>
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
          <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 py-16">
            <Target className="h-10 w-10 text-slate-200" />
            <p className="mt-3 text-sm font-medium text-slate-500">暂无目标</p>
            <p className="mt-1 text-xs text-slate-400">
              {statusFilter || typeFilter ? '没有符合条件的目标' : '设定第一个目标，追踪你的进度'}
            </p>
          </div>
        )}

        {/* 列表 */}
        {!isLoading && !error && goalList.map(goal => (
          <GoalCard
            key={goal.id}
            goal={goal}
            onEdit={(g) => { setEditGoal(g); setShowForm(true); }}
            onDelete={handleDelete}
          />
        ))}
      </div>

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
