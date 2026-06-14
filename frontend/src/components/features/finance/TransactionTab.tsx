'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Search, Trash2, ArrowDownLeft, ArrowUpRight,
  Hand, Inbox, RefreshCw, ChevronDown, ChevronUp,
  Loader2, ReceiptText, FolderKanban, CheckSquare,
  Pencil, X, CalendarDays, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';
import { useTransactions, useDeleteTransaction, type Transaction } from '@/hooks/useTransactions';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { TransactionForm } from './TransactionForm';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';

/* ═══════════ 格式化 ═══════════ */

function formatYuan(fen: number): string {
  return (fen / 100).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return '今天';
  if (d.toDateString() === yesterday.toDateString()) return '昨天';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* ═══════════ 日期快捷 ═══════════ */

function getDateRange(preset: string): { startDate?: string; endDate?: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  switch (preset) {
    case 'today':
      return { startDate: fmt(now), endDate: fmt(now) };
    case 'week': {
      const s = new Date(now);
      s.setDate(now.getDate() - now.getDay() + 1);
      return { startDate: fmt(s), endDate: fmt(now) };
    }
    case 'month':
      return { startDate: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: fmt(now) };
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3) * 3;
      return { startDate: fmt(new Date(now.getFullYear(), q, 1)), endDate: fmt(now) };
    }
    case 'year':
      return { startDate: fmt(new Date(now.getFullYear(), 0, 1)), endDate: fmt(now) };
    default:
      return {};
  }
}

/* ═══════════ 常量 ═══════════ */

const SOURCE_ICONS: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  MANUAL: { icon: Hand, label: '手动' },
  PAYMENT: { icon: Inbox, label: '回款' },
  SUBSCRIPTION: { icon: RefreshCw, label: '订阅' },
};

const CATEGORY_LABELS: Record<string, string> = {
  PROJECT_PAYMENT: '项目回款', INTEREST: '利息收益', REFUND: '退款返佣',
  SUBSIDY: '补贴奖金', ASSET_SALE: '资产出售', FREELANCE: '兼职收入',
  OTHER_INCOME: '其他收入', LOAN_REPAYMENT: '借款还款',
  PROJECT_COST: '项目成本', RENT: '房租水电', SUBSCRIPTION: '软件订阅',
  EQUIPMENT: '设备采购', TRAVEL: '差旅交通', MEAL: '餐饮招待',
  TAX: '税费', MARKETING: '推广广告', INSURANCE: '保险',
  SALARY: '工资薪酬', LOAN_LEND: '借款支出', OFFICE: '办公用品',
  OTHER_EXPENSE: '其他支出',
};

const CATEGORY_COLORS: Record<string, string> = {
  PROJECT_PAYMENT: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  INTEREST: 'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400',
  REFUND: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400',
  SUBSIDY: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
  FREELANCE: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400',
  LOAN_REPAYMENT: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400',
  ASSET_SALE: 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400',
  OTHER_INCOME: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400',
  RENT: 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400',
  SUBSCRIPTION: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400',
  EQUIPMENT: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  TRAVEL: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-950/40 dark:text-yellow-400',
  MEAL: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
  TAX: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400',
  MARKETING: 'bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-400',
  INSURANCE: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400',
  SALARY: 'bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-950/40 dark:text-fuchsia-400',
  LOAN_LEND: 'bg-lime-50 text-lime-600 dark:bg-lime-950/40 dark:text-lime-400',
  OFFICE: 'bg-stone-100 text-stone-600 dark:bg-stone-950/40 dark:text-stone-400',
  OTHER_EXPENSE: 'bg-stone-100 text-stone-600 dark:bg-stone-950/40 dark:text-stone-400',
};

const INCOME_CATEGORIES = [
  'PROJECT_PAYMENT', 'INTEREST', 'REFUND', 'SUBSIDY', 'FREELANCE',
  'LOAN_REPAYMENT', 'ASSET_SALE', 'OTHER_INCOME',
];

const EXPENSE_CATEGORIES = [
  'PROJECT_COST', 'SALARY', 'RENT', 'MEAL', 'TRAVEL', 'EQUIPMENT',
  'OFFICE', 'SUBSCRIPTION', 'MARKETING', 'TAX', 'INSURANCE',
  'LOAN_LEND', 'OTHER_EXPENSE',
];

const DIRECTION_FILTERS = [
  { value: '', label: '全部' },
  { value: 'INCOME', label: '收入' },
  { value: 'EXPENSE', label: '支出' },
];

const DATE_PRESETS = [
  { value: 'today', label: '今日' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
  { value: 'quarter', label: '本季度' },
  { value: 'year', label: '本年' },
];

/* ═══════════ 单条流水 ═══════════ */

function TransactionRow({
  tx, onEdit, onDelete,
}: {
  tx: Transaction;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isIncome = tx.direction === 'INCOME';
  const sourceInfo = SOURCE_ICONS[tx.source] || SOURCE_ICONS.MANUAL;
  const SourceIcon = sourceInfo.icon;
  const projectName = tx.project?.name || tx.payment?.project?.name;
  const taskTitle = tx.task?.title;

  return (
    <div
      className="group flex items-center gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-muted/40"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
        isIncome ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-rose-50 dark:bg-rose-950/40',
      )}>
        {isIncome
          ? <ArrowDownLeft className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
          : <ArrowUpRight className="h-4.5 w-4.5 text-rose-600 dark:text-rose-400" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground/80">{tx.description}</span>
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-2xs-plus font-medium',
            CATEGORY_COLORS[tx.category] || 'bg-muted text-muted-foreground')}>
            {CATEGORY_LABELS[tx.category] || tx.category}
          </span>
          {tx.source !== 'MANUAL' && (
            <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-2xs font-medium',
              tx.source === 'PAYMENT' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                : 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400')}>
              <SourceIcon className="h-2.5 w-2.5" />
              {sourceInfo.label}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-2xs-plus text-muted-foreground">
          <span>{formatTime(tx.date)}</span>
          {projectName && <span className="flex items-center gap-1"><FolderKanban className="h-3 w-3" />{projectName}</span>}
          {taskTitle && <span className="flex items-center gap-1"><CheckSquare className="h-3 w-3" />{taskTitle}</span>}
        </div>
      </div>

      <span className={cn(
        'shrink-0 font-mono text-sm font-medium tabular-nums',
        isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground/80',
      )}>
        {isIncome ? '+' : '-'}¥{formatYuan(tx.amount)}
      </span>

      {tx.source === 'MANUAL' && (
        <div className={cn('shrink-0 flex items-center gap-0.5 transition-opacity duration-150',
          hovered ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
          <button onClick={() => onEdit(tx)}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onDelete(tx)}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════ 日期分组 ═══════════ */

function DateGroup({
  date, transactions, onEdit, onDelete,
}: {
  date: string;
  transactions: Transaction[];
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const dayTotal = transactions.reduce((s, tx) => s + (tx.direction === 'INCOME' ? tx.amount : -tx.amount), 0);

  return (
    <div>
      <button onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-left transition-colors hover:bg-muted/50">
        {collapsed
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="text-sm font-medium text-foreground">{formatDate(date)}</span>
        <span className="text-2xs-plus text-muted-foreground">{transactions.length} 笔</span>
        <span className={cn('ml-auto font-mono text-sm tabular-nums',
          dayTotal >= 0 ? 'text-emerald-600' : 'text-muted-foreground')}>
          {dayTotal >= 0 ? '+' : ''}¥{formatYuan(Math.abs(dayTotal))}
        </span>
      </button>
      {!collapsed && (
        <div className="mt-0.5 space-y-0.5 pl-2 pb-1">
          {transactions.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════ 主组件 ═══════════ */

export function TransactionTab() {
  const [page, setPage] = useState(1);
  const [direction, setDirection] = useState('');
  const [source, setSource] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formDirection, setFormDirection] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  // 监听页面级记账事件
  useEffect(() => {
    const handler = (e: Event) => {
      const dir = (e as CustomEvent).detail as 'INCOME' | 'EXPENSE';
      setFormDirection(dir);
      setEditingTx(null);
      setFormOpen(true);
    };
    document.addEventListener('tx:open-form', handler);
    return () => document.removeEventListener('tx:open-form', handler);
  }, []);

  const dateRange = useMemo(() => {
    if (showCustomDate && (customStart || customEnd)) {
      return {
        ...(customStart ? { startDate: customStart } : {}),
        ...(customEnd ? { endDate: customEnd } : {}),
      };
    }
    return getDateRange(datePreset);
  }, [datePreset, showCustomDate, customStart, customEnd]);

  const { data, isLoading } = useTransactions({
    page, limit: 30,
    ...(direction ? { direction } : {}),
    ...(source ? { source } : {}),
    ...(category ? { category } : {}),
    ...(search ? { search } : {}),
    ...dateRange,
  });

  const deleteTx = useDeleteTransaction();

  const filteredCategories = useMemo(() => {
    if (direction === 'INCOME') return INCOME_CATEGORIES;
    if (direction === 'EXPENSE') return EXPENSE_CATEGORIES;
    return [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];
  }, [direction]);

  const grouped = data?.data.reduce<Record<string, Transaction[]>>((acc, tx) => {
    const d = new Date(tx.date).toDateString();
    (acc[d] ??= []).push(tx);
    return acc;
  }, {});

  const handleEdit = useCallback((tx: Transaction) => {
    setEditingTx(tx);
    setFormDirection(tx.direction);
    setFormOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    deleteTx.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  }, [deleteTarget, deleteTx]);

  const handleDirectionChange = useCallback((d: string) => {
    setDirection(d);
    setCategory('');
    setPage(1);
  }, []);

  return (
    <div className="flex flex-col gap-5">
      {/* ── 筛选栏 ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* 方向 */}
        <div className="flex h-9 items-center gap-0.5 rounded-xl border border-border/50 bg-card p-0.5 shadow-sm">
          {DIRECTION_FILTERS.map((opt) => (
            <button key={opt.value}
              onClick={() => handleDirectionChange(opt.value)}
              className={cn('rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200',
                direction === opt.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground')}>
              {opt.label}
            </button>
          ))}
        </div>

        {/* 日期快捷 */}
        <div className="flex h-9 items-center gap-0.5 rounded-xl border border-border/50 bg-card p-0.5 shadow-sm">
          {DATE_PRESETS.map((p) => (
            <button key={p.value}
              onClick={() => { setDatePreset(p.value); setShowCustomDate(false); setCustomStart(''); setCustomEnd(''); setPage(1); }}
              className={cn('rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200',
                datePreset === p.value && !showCustomDate
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground')}>
              {p.label}
            </button>
          ))}
        </div>

        {/* 来源 */}
        <Select value={source || 'all_source_placeholder'} onValueChange={(v) => { setSource(v === 'all_source_placeholder' ? '' : (v ?? '')); setPage(1); }}>
          <SelectTrigger className="w-auto h-9 rounded-lg border border-border bg-card px-3 pr-8 text-sm text-foreground/80 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60">
            <SelectValue placeholder="全部来源" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all_source_placeholder">全部来源</SelectItem>
            <SelectItem value="MANUAL">手动录入</SelectItem>
            <SelectItem value="PAYMENT">回款触发</SelectItem>
            <SelectItem value="SUBSCRIPTION">订阅自动</SelectItem>
          </SelectContent>
        </Select>

        {/* 分类 */}
        <Select value={category || 'all_category_placeholder'} onValueChange={(v) => { setCategory(v === 'all_category_placeholder' ? '' : (v ?? '')); setPage(1); }}>
          <SelectTrigger className="w-auto h-9 rounded-lg border border-border bg-card px-3 pr-8 text-sm text-foreground/80 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60">
            <SelectValue placeholder="全部分类" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all_category_placeholder">全部分类</SelectItem>
            {filteredCategories.map((c) => (
              <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 搜索 */}
        <div className="relative flex-1 min-w-[160px] max-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input placeholder="搜索描述或备注..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-xl border border-border/50 bg-transparent pl-9 pr-3 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60" />
        </div>

        {/* 自定义日期按钮 */}
        <button
          onClick={() => setShowCustomDate(!showCustomDate)}
          className={cn('flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-all duration-200',
            showCustomDate
              ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-400'
              : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-border')}>
          <CalendarDays className="h-4 w-4" />
          自定义日期
        </button>
      </div>

      {/* ── 自定义日期范围（独立区域） ── */}
      {showCustomDate && (
        <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card px-4 py-3 shadow-sm">
          <span className="text-sm text-foreground/70 shrink-0">时间范围</span>
          <DatePicker value={customStart} onChange={(v) => { setCustomStart(v); setPage(1); }} />
          <DatePicker value={customEnd} onChange={(v) => { setCustomEnd(v); setPage(1); }} />
          {(customStart || customEnd) && (
            <button onClick={() => { setCustomStart(''); setCustomEnd(''); setPage(1); }}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* ── 列表 ── */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !grouped || Object.keys(grouped).length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
            <ReceiptText className="h-12 w-12 opacity-20" />
            <p className="text-sm font-medium">还没有流水记录</p>
            <p className="text-xs text-muted-foreground/60">点击右上角按钮开始记账</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30 p-2">
            {Object.entries(grouped).map(([_, txs]) => (
              <DateGroup key={txs[0].date} date={txs[0].date} transactions={txs}
                onEdit={handleEdit} onDelete={setDeleteTarget} />
            ))}
          </div>
        )}

        {data && data.total > data.limit && (
          <div className="flex items-center justify-between border-t border-border/40 px-5 py-3">
            <span className="text-xs text-muted-foreground">共 {data.total} 条</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground/70 hover:bg-muted">
                上一页
              </Button>
              <Button size="sm" variant="outline" disabled={page * data.limit >= data.total} onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground/70 hover:bg-muted">
                下一页
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── 删除确认 ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4.5 w-4.5 text-rose-500" />
              确认删除
            </DialogTitle>
            <DialogDescription>
              确定要删除这条记录吗？
              {deleteTarget && (
                <span className="block mt-1.5 text-sm">
                  <span className="font-medium text-foreground/80">{deleteTarget.description}</span>
                  <span className="text-muted-foreground ml-2">
                    {deleteTarget.direction === 'INCOME' ? '+' : '-'}¥{formatYuan(deleteTarget.amount)}
                  </span>
                </span>
              )}
              <span className="block mt-1 text-xs text-muted-foreground/70">此操作不可撤销</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground/70 hover:bg-muted">
              取消
            </Button>
            <Button onClick={handleDeleteConfirm} disabled={deleteTx.isPending}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 active:scale-95 disabled:opacity-50">
              {deleteTx.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 表单 ── */}
      <TransactionForm
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingTx(null); }}
        defaultDirection={formDirection}
        editingTx={editingTx}
      />
    </div>
  );
}
