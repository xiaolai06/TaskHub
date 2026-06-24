'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CreateCostInput } from '@/hooks/useCosts';
import { DatePicker } from '@/components/ui/date-picker';
import { CustomSelect } from '@/components/ui/custom-select';
import type { Task } from '@/hooks/useTasks';

// ─── Zod Schemas ──────────────────────────────────────────

const costFormSchema = z.object({
  amount: z.number().min(0.01, '金额必须大于0'),
  category: z.string(),
  description: z.string().min(1, '说明不能为空'),
  date: z.string(),
});

type CostFormValues = z.infer<typeof costFormSchema>;

const costFormContentSchema = z.object({
  amount: z.number().min(0.01, '金额必须大于0'),
  description: z.string().min(1, '描述不能为空').max(200, '不超过200字'),
  note: z.string().optional(),
  costType: z.enum(['EXPENSE', 'INCOME']),
  category: z.string().min(1, '请选择分类'),
  customCategory: z.string().optional(),
});

type CostFormContentValues = z.infer<typeof costFormContentSchema>;

// ─── Constants ────────────────────────────────────────────

const INCOME_CATEGORIES = [
  { value: 'PROJECT_PAYMENT', label: '项目回款' },
  { value: 'INTEREST', label: '利息收益' },
  { value: 'REFUND', label: '退款返佣' },
  { value: 'SUBSIDY', label: '补贴奖金' },
  { value: 'FREELANCE', label: '兼职收入' },
  { value: 'LOAN_REPAYMENT', label: '借款还款' },
  { value: 'ASSET_SALE', label: '资产出售' },
  { value: 'OTHER_INCOME', label: '其他收入' },
  { value: 'CUSTOM', label: '+ 自定义' },
];

const EXPENSE_CATEGORIES = [
  { value: 'PROJECT_COST', label: '项目成本' },
  { value: 'SALARY', label: '工资薪酬' },
  { value: 'RENT', label: '房租水电' },
  { value: 'MEAL', label: '餐饮招待' },
  { value: 'TRAVEL', label: '差旅交通' },
  { value: 'EQUIPMENT', label: '设备采购' },
  { value: 'OFFICE', label: '办公用品' },
  { value: 'SUBSCRIPTION', label: '软件订阅' },
  { value: 'MARKETING', label: '推广广告' },
  { value: 'TAX', label: '税费' },
  { value: 'INSURANCE', label: '保险' },
  { value: 'LOAN_LEND', label: '借款支出' },
  { value: 'OTHER_EXPENSE', label: '其他支出' },
  { value: 'CUSTOM', label: '+ 自定义' },
];

const inputCls = 'w-full rounded-lg border border-border px-3 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60';

// ─── CostForm (inline row form, used in cost list) ────────

interface CostFormProps {
  onSubmit: (data: CreateCostInput) => void;
  isLoading?: boolean;
}

export function CostForm({ onSubmit, isLoading }: CostFormProps) {
  const {
    register, control, handleSubmit, reset,
    formState: { errors },
  } = useForm<CostFormValues>({
    resolver: zodResolver(costFormSchema),
    defaultValues: {
      amount: 0,
      category: 'PROJECT_COST',
      description: '',
      date: new Date().toISOString().split('T')[0],
    },
  });

  function onFormSubmit(values: CostFormValues) {
    onSubmit({
      amount: Math.round(values.amount * 100),
      category: values.category,
      description: values.description.trim(),
      date: values.date,
    });
    reset({
      amount: 0,
      category: 'PROJECT_COST',
      description: '',
      date: new Date().toISOString().split('T')[0],
    });
  }

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="grid grid-cols-[120px_120px_1fr_120px_auto] gap-2">
      <div>
        <label htmlFor="cost-amount" className="sr-only">成本金额</label>
        <input
          id="cost-amount"
          type="number"
          step="0.01"
          {...register('amount', { valueAsNumber: true })}
          placeholder="成本金额"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300"
        />
        {errors.amount && <p className="text-xs text-destructive mt-0.5">{errors.amount.message}</p>}
      </div>
      <Controller name="category" control={control} render={({ field }) => (
        <CustomSelect value={field.value} options={EXPENSE_CATEGORIES} onChange={field.onChange} />
      )} />
      <div>
        <label htmlFor="cost-description" className="sr-only">成本说明</label>
        <input
          id="cost-description"
          {...register('description')}
          placeholder="成本说明，如外包、服务器、素材"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300"
        />
        {errors.description && <p className="text-xs text-destructive mt-0.5">{errors.description.message}</p>}
      </div>
      <Controller name="date" control={control} render={({ field }) => (
        <DatePicker value={field.value} onChange={field.onChange} />
      )} />
      <button
        type="submit"
        disabled={isLoading}
        className="flex h-10 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white disabled:opacity-50"
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        添加
      </button>
    </form>
  );
}

// ─── CostFormContent (Quick Bookkeeping Side Panel) ───────

interface CostFormContentProps {
  task: Task;
  projectId: string;
  onSave: (id: string, data: { cost: number; costNote?: string }) => void;
  onCreateCost?: (data: CreateCostInput) => void;
  onClose: () => void;
}

export function CostFormContent({ task, projectId, onSave, onCreateCost, onClose }: CostFormContentProps) {
  const {
    register, control, handleSubmit, watch, setValue,
    formState: { errors },
  } = useForm<CostFormContentValues>({
    resolver: zodResolver(costFormContentSchema),
    defaultValues: {
      amount: 0,
      description: '',
      note: '',
      costType: 'EXPENSE',
      category: 'PROJECT_COST',
      customCategory: '',
    },
  });

  const watchedCostType = watch('costType');
  const watchedCategory = watch('category');
  const currentCategories = watchedCostType === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const isCustom = watchedCategory === 'CUSTOM';

  // 切换类型时重置分类
  function handleTypeChange(type: 'EXPENSE' | 'INCOME') {
    setValue('costType', type);
    const cats = type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    setValue('category', cats[0].value);
    setValue('customCategory', '');
  }

  function onFormSubmit(values: CostFormContentValues) {
    const rawAmount = values.amount;
    const costFen = Math.round(rawAmount * 100);
    const displayAmount = rawAmount.toFixed(2);
    const typeLabel = values.costType === 'INCOME' ? '收入' : '支出';

    // 最终分类：自定义则取 customCategory，否则取预设
    const finalCategory = isCustom ? (values.customCategory?.trim() || 'OTHER_EXPENSE') : values.category;

    // task.costNote 追加记录
    const summary = values.description.trim();
    const newEntry = `[${typeLabel}]${summary}:¥${displayAmount}`;
    const existing = task.costNote || '';

    // 更新任务成本（支出加，收入减）
    const delta = values.costType === 'INCOME' ? -costFen : costFen;
    onSave(task.id, {
      cost: Math.max(0, (task.cost || 0) + delta),
      costNote: existing ? `${existing}；${newEntry}` : newEntry,
    });

    // 同步到 CostRecord + Transaction
    if (onCreateCost && projectId) {
      // description: 摘要信息（简短，用于列表展示）
      const costDesc = `${summary}（任务：${task.title}）`;
      // note: 补充说明，存入 Transaction.note
      onCreateCost({
        amount: costFen,
        direction: values.costType,
        category: finalCategory,
        description: costDesc,
        date: new Date().toISOString().split('T')[0],
        taskId: task.id,
      });
    }

    onClose();
  }

  return (
    <div className="px-5 py-4">
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
        {/* 类型：支出 / 收入 */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground/70">类型</label>
          <div className="flex gap-2">
            <Controller name="costType" control={control} render={({ field }) => (
              <>
                <button
                  type="button"
                  onClick={() => handleTypeChange('EXPENSE')}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all',
                    field.value === 'EXPENSE'
                      ? 'border-red-300 bg-red-50 text-red-600 dark:border-red-700 dark:bg-red-950/40 dark:text-red-400'
                      : 'border-border text-muted-foreground hover:bg-muted',
                  )}
                >
                  <TrendingDown className="h-4 w-4" />
                  支出
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('INCOME')}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all',
                    field.value === 'INCOME'
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                      : 'border-border text-muted-foreground hover:bg-muted',
                  )}
                >
                  <TrendingUp className="h-4 w-4" />
                  收入
                </button>
              </>
            )} />
          </div>
        </div>

        {/* 金额 */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground/70">金额（元）</label>
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-lg font-bold tabular-nums',
              watchedCostType === 'INCOME' ? 'text-emerald-500' : 'text-red-500',
            )}>
              {watchedCostType === 'INCOME' ? '+' : '-'}¥
            </span>
            <input
              type="number"
              {...register('amount', { valueAsNumber: true })}
              placeholder="0.00"
              min="0"
              step="0.01"
              autoFocus
              className={cn(inputCls, 'flex-1 text-lg font-semibold')}
            />
          </div>
          {errors.amount && <p className="mt-0.5 text-xs text-destructive">{errors.amount.message}</p>}
        </div>

        {/* 描述（必填，简短摘要） */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground/70">
            描述 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            {...register('description')}
            placeholder={watchedCostType === 'INCOME' ? '如：收到项目首付款' : '如：支付外包开发费'}
            className={inputCls}
          />
          {errors.description && <p className="mt-0.5 text-xs text-destructive">{errors.description.message}</p>}
        </div>

        {/* 分类 */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground/70">分类</label>
          <Controller name="category" control={control} render={({ field }) => (
            <CustomSelect value={field.value} options={currentCategories} onChange={field.onChange} />
          )} />
          {/* 自定义分类输入 */}
          {isCustom && (
            <input
              type="text"
              {...register('customCategory')}
              placeholder="输入自定义分类名称"
              className={cn(inputCls, 'mt-2')}
            />
          )}
        </div>

        {/* 备注（可选，补充说明） */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground/70">备注（可选）</label>
          <textarea
            {...register('note')}
            placeholder="补充说明，如付款方式、发票号等"
            rows={2}
            className={cn(inputCls, 'resize-none')}
          />
        </div>

        {/* 按钮 */}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="h-10 flex-1 rounded-lg border border-border px-4 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted">
            取消
          </button>
          <button type="submit"
            className={cn(
              'h-10 flex-1 rounded-lg px-4 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              watchedCostType === 'INCOME'
                ? 'bg-emerald-500 hover:bg-emerald-600'
                : 'bg-amber-500 hover:bg-amber-600',
            )}>
            {watchedCostType === 'INCOME' ? '记录收入' : '记录支出'}
          </button>
        </div>
      </form>

      {/* 已有记录 */}
      {task.costNote && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-1.5 text-2xs-plus font-medium text-muted-foreground">已有记录：</p>
          <div className="space-y-1">
            {task.costNote.split('；').map((entry, i) => (
              <p key={i} className={cn(
                'text-2xs-plus',
                entry.startsWith('[收入]') ? 'text-emerald-600' : 'text-muted-foreground',
              )}>
                · {entry}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
