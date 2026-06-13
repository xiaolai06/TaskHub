'use client';

import { useState, useEffect } from 'react';
import { Loader2, X } from 'lucide-react';
import { useCreateTransaction, type CreateTransactionInput } from '@/hooks/useTransactions';
import { useProjectList } from '@/hooks/useProjects';
import { useProjectTasks } from '@/hooks/useTasks';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const inputCls = 'w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none';
const labelCls = 'mb-1.5 block text-sm font-medium text-foreground/80';

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

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDirection: 'INCOME' | 'EXPENSE';
}

export function TransactionForm({ open, onOpenChange, defaultDirection }: TransactionFormProps) {
  const [direction, setDirection] = useState<'INCOME' | 'EXPENSE'>(defaultDirection);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [projectId, setProjectId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [note, setNote] = useState('');

  const createTx = useCreateTransaction();
  const { data: projectsData } = useProjectList();
  const projects = projectsData?.data || [];
  const { data: tasks } = useProjectTasks(projectId);
  const projectTasks = tasks || [];

  useEffect(() => {
    if (open) {
      setDirection(defaultDirection);
      setAmount(''); setCategory(''); setCustomCategory(''); setDescription('');
      setDate(new Date().toISOString().slice(0, 10));
      setProjectId(''); setTaskId(''); setNote('');
    }
  }, [open, defaultDirection]);

  useEffect(() => { setTaskId(''); }, [projectId]);

  const categories = direction === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const isCustom = category === 'CUSTOM';
  const finalCategory = isCustom ? customCategory.trim() : category;

  const handleSubmit = () => {
    if (!amount || !finalCategory || !description || !date) return;
    createTx.mutate({
      amount: Math.round(Number(amount) * 100), direction,
      category: finalCategory, description, date,
      projectId: projectId || undefined, taskId: taskId || undefined, note: note || undefined,
    }, { onSuccess: () => onOpenChange(false) });
  };

  const isValid = amount && Number(amount) > 0 && finalCategory && description && date;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        {/* Header */}
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{direction === 'INCOME' ? '记一笔收入' : '记一笔支出'}</SheetTitle>
          <SheetDescription>手动录入的记录可以在流水列表中编辑或删除</SheetDescription>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-4">
            {/* Direction Toggle */}
            <div className="flex gap-1 rounded-xl border border-border bg-muted p-1">
              {(['INCOME', 'EXPENSE'] as const).map((d) => (
                <button key={d} onClick={() => { setDirection(d); setCategory(''); setCustomCategory(''); }}
                  className={cn('flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors',
                    direction === d
                      ? d === 'INCOME' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-rose-600 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground')}>
                  {d === 'INCOME' ? '收入' : '支出'}
                </button>
              ))}
            </div>

            {/* Amount */}
            <div>
              <label className={labelCls}>金额（元）<span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">¥</span>
                <input type="number" placeholder="0.00" value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={cn(inputCls, 'pl-8 font-mono')} min="0" step="0.01" />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className={labelCls}>类别 <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-4 gap-2">
                {categories.map((cat) => (
                  <button key={cat.value} onClick={() => setCategory(cat.value)}
                    className={cn('rounded-lg border px-2 py-2 text-xs font-medium transition-colors',
                      category === cat.value
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400'
                        : 'border-border text-muted-foreground hover:border-indigo-200 hover:text-foreground')}>
                    {cat.label}
                  </button>
                ))}
              </div>
              {isCustom && (
                <input type="text" value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="输入自定义类别名称"
                  className={cn(inputCls, 'mt-2')} />
              )}
            </div>

            {/* Date */}
            <div>
              <label className={labelCls}>日期 <span className="text-red-500">*</span></label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </div>

            {/* Project */}
            <div>
              <label className={labelCls}>关联项目</label>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputCls}>
                <option value="">不关联项目</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {/* Task */}
            {projectId && (
              <div>
                <label className={labelCls}>关联任务</label>
                <select value={taskId} onChange={(e) => setTaskId(e.target.value)} className={inputCls}>
                  <option value="">不关联任务</option>
                  {projectTasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </div>
            )}

            {/* Description */}
            <div>
              <label className={labelCls}>描述 <span className="text-red-500">*</span></label>
              <input type="text"
                placeholder={direction === 'INCOME' ? '如：利息收入' : '如：团队午餐'}
                value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
            </div>

            {/* Note */}
            <div>
              <label className={labelCls}>备注</label>
              <input type="text" placeholder="可选备注..." value={note}
                onChange={(e) => setNote(e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>

        {/* Fixed footer */}
        <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
          <button onClick={() => onOpenChange(false)}
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none">
            取消
          </button>
          <button onClick={handleSubmit} disabled={!isValid || createTx.isPending}
            className={cn('flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none active:scale-95',
              direction === 'INCOME' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700')}>
            {createTx.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            确认记账
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
