'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useCreateTransaction, useUpdateTransaction, type Transaction, type CreateTransactionInput } from '@/hooks/useTransactions';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { useProjectList } from '@/hooks/useProjects';
import { useProjectTasks } from '@/hooks/useTasks';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';

const inputCls = 'w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60';
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
  editingTx?: Transaction | null;
}

export function TransactionForm({ open, onOpenChange, defaultDirection, editingTx }: TransactionFormProps) {
  const isEditing = !!editingTx;

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
  const updateTx = useUpdateTransaction();
  const isPending = isEditing ? updateTx.isPending : createTx.isPending;

  const { data: projectsData } = useProjectList();
  const projects = projectsData?.data || [];
  const { data: tasks } = useProjectTasks(projectId);
  const projectTasks = tasks || [];

  // 打开时填充表单
  useEffect(() => {
    if (open) {
      if (editingTx) {
        // 编辑模式：预填数据
        setDirection(editingTx.direction);
        setAmount(String(editingTx.amount / 100));
        // 检查是否是预设分类
        const allPreset = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES].map((c) => c.value);
        if (allPreset.includes(editingTx.category)) {
          setCategory(editingTx.category);
          setCustomCategory('');
        } else {
          setCategory('CUSTOM');
          setCustomCategory(editingTx.category);
        }
        setDescription(editingTx.description);
        setDate(new Date(editingTx.date).toISOString().slice(0, 10));
        setProjectId(editingTx.projectId || '');
        setTaskId(editingTx.taskId || '');
        setNote(editingTx.note || '');
      } else {
        // 新增模式：重置
        setDirection(defaultDirection);
        setAmount(''); setCategory(''); setCustomCategory(''); setDescription('');
        setDate(new Date().toISOString().slice(0, 10));
        setProjectId(''); setTaskId(''); setNote('');
      }
    }
  }, [open, editingTx, defaultDirection]);

  useEffect(() => { if (!isEditing) setTaskId(''); }, [projectId, isEditing]);

  const categories = direction === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const isCustom = category === 'CUSTOM';
  const finalCategory = isCustom ? customCategory.trim() : category;

  const handleSubmit = () => {
    if (!amount || !finalCategory || !description || !date) return;

    if (isEditing && editingTx) {
      updateTx.mutate({
        id: editingTx.id,
        data: {
          amount: Math.round(Number(amount) * 100),
          category: finalCategory,
          description,
          date,
          projectId: projectId || undefined,
          taskId: taskId || undefined,
          note: note || undefined,
        },
      }, { onSuccess: () => onOpenChange(false) });
    } else {
      createTx.mutate({
        amount: Math.round(Number(amount) * 100), direction,
        category: finalCategory, description, date,
        projectId: projectId || undefined, taskId: taskId || undefined, note: note || undefined,
      }, { onSuccess: () => onOpenChange(false) });
    }
  };

  const isValid = amount && Number(amount) > 0 && finalCategory && description && date;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col max-h-[90vh] p-0">
        {/* Header */}
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>
            {isEditing ? '编辑记录' : direction === 'INCOME' ? '记一笔收入' : '记一笔支出'}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? '修改记录后将实时更新' : '手动录入的记录可以在流水列表中编辑或删除'}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-4">
            {/* Direction Toggle */}
            <div className="flex gap-1 rounded-xl border border-border bg-muted p-1">
              {(['INCOME', 'EXPENSE'] as const).map((d) => (
                <button key={d}
                  onClick={() => { if (!isEditing) { setDirection(d); setCategory(''); setCustomCategory(''); } }}
                  disabled={isEditing}
                  className={cn('flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors',
                    isEditing && 'cursor-not-allowed opacity-60',
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
              <DatePicker value={date} onChange={setDate} />
            </div>

            {/* Project */}
            <div>
              <label className={labelCls}>关联项目</label>
              <Select value={projectId} onValueChange={(v) => setProjectId(v || "")}>
                <SelectTrigger className={cn(inputCls, "w-full")}><SelectValue placeholder="不关联项目" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Task */}
            {projectId && (
              <div>
                <label className={labelCls}>关联任务</label>
                <Select value={taskId} onValueChange={(v) => setTaskId(v || "")}>
                  <SelectTrigger className={cn(inputCls, "w-full")}><SelectValue placeholder="不关联任务" /></SelectTrigger>
                  <SelectContent>
                    {projectTasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                  </SelectContent>
                </Select>
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
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted">
            取消
          </button>
          <button onClick={handleSubmit} disabled={!isValid || isPending}
            className={cn('flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 active:scale-95',
              direction === 'INCOME' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700')}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEditing ? '保存修改' : '确认记账'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
