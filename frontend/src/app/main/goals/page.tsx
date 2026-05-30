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
  useCalculateProgress,
  useUpdateMilestone,
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

  // 数据查询
  const { data: goals, isLoading, error } = useGoalList({
    status: statusFilter || undefined,
    type: typeFilter || undefined,
  });
  const { data: overview, isLoading: overviewLoading } = useGoalOverview();
  const { data: projects } = useProjectList();
  const { data: customers } = useCustomerList();

  // 变更操作
  const createMutation = useCreateGoal();
  const updateMutation = useUpdateGoal();
  const deleteMutation = useDeleteGoal();
  const calculateMutation = useCalculateProgress();
  const updateMilestoneMutation = useUpdateMilestone();

  const goalList = goals || [];

  // ======================== 操作处理 ========================

  function handleCreate(input: unknown) {
    createMutation.mutate(input, {
      onSuccess: () => {
        setShowForm(false);
        toast.success('目标创建成功');
      },
      onError: (err) => toast.error('创建失败：' + (err instanceof Error ? err.message : '请重试')),
    });
  }

  function handleUpdate(input: unknown) {
    if (!editGoal) return;
    updateMutation.mutate(
      { id: editGoal.id, data: input },
      {
        onSuccess: () => {
          setShowForm(false);
          setEditGoal(null);
          toast.success('目标更新成功');
        },
        onError: (err) => toast.error('更新失败：' + (err instanceof Error ? err.message : '请重试')),
      },
    );
  }

  function handleDelete(id: string) {
    if (confirm('确定要删除这个目标吗？关联的里程碑和进度记录也会被删除。')) {
      deleteMutation.mutate(id, {
        onSuccess: () => toast.success('目标已删除'),
        onError: () => toast.error('删除失败，请重试'),
      });
    }
  }

  function handleCalculate(id: string) {
    calculateMutation.mutate(id, {
      onSuccess: (data) => {
        if (data.sourceCount > 0) {
          toast.success(data.message);
        } else {
          toast.info(data.message);
        }
      },
      onError: () => toast.error('计算失败，请重试'),
    });
  }

  function handleEdit(goal: Goal) {
    setEditGoal(goal);
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditGoal(null);
  }

  function handleToggleMilestone(goalId: string, milestoneId: string, completed: boolean) {
    updateMilestoneMutation.mutate(
      { goalId, milestoneId, data: { completed } },
      {
        onSuccess: () => toast.success(completed ? '里程碑已完成' : '里程碑已取消完成'),
        onError: () => toast.error('操作失败'),
      },
    );
  }

  // ======================== 渲染 ========================

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      {/* 目标总览 */}
      <GoalOverview data={overview} isLoading={overviewLoading} />

      {/* 筛选栏 + 新建按钮 */}
      <div className="flex items-center justify-between gap-4">
        <GoalFilter
          status={statusFilter}
          type={typeFilter}
          onStatusChange={setStatusFilter}
          onTypeChange={setTypeFilter}
        />
        <button
          onClick={() => { setEditGoal(null); setShowForm(true); }}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          新建目标
        </button>
      </div>

      {/* 加载态 */}
      {isLoading && (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      )}

      {/* 错误态 */}
      {error && !isLoading && (
        <div className="flex flex-col items-center justify-center py-32">
          <AlertTriangle className="h-10 w-10 text-red-300" />
          <p className="mt-4 text-sm text-red-500">加载失败，请稍后重试</p>
        </div>
      )}

      {/* 空状态 */}
      {!isLoading && !error && goalList.length === 0 && (
        <div className="flex flex-col items-center justify-center py-32">
          <Target className="h-12 w-12 text-slate-200" />
          <p className="mt-4 text-sm font-medium text-slate-500">暂无目标</p>
          <p className="mt-1 text-xs text-slate-400">
            {statusFilter || typeFilter
              ? '没有符合条件的目标，试试调整筛选条件'
              : '点击上方按钮创建第一个目标'}
          </p>
        </div>
      )}

      {/* 目标列表 */}
      {!isLoading && !error && goalList.length > 0 && (
        <div className="space-y-4">
          {goalList.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onCalculate={handleCalculate}
              onToggleMilestone={handleToggleMilestone}
            />
          ))}
        </div>
      )}

      {/* 目标表单弹窗 */}
      <GoalForm
        open={showForm}
        onClose={handleCloseForm}
        onSubmit={editGoal ? handleUpdate : handleCreate}
        isLoading={createMutation.isPending || updateMutation.isPending}
        editGoal={editGoal}
        projects={projects || []}
        customers={customers || []}
      />
    </div>
  );
}
