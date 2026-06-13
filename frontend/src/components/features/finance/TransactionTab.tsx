'use client';

import { useState } from 'react';
import {
  Plus, Search, Trash2, ArrowDownLeft, ArrowUpRight,
  Hand, Inbox, RefreshCw, ChevronDown, ChevronUp,
  Loader2, ReceiptText, FolderKanban, CheckSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTransactions, useDeleteTransaction, type Transaction } from '@/hooks/useTransactions';
import { Button } from '@/components/ui/button';
import { TransactionForm } from './TransactionForm';

/* ── 格式化 ── */
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

/* ── 常量 ── */
const SOURCE_ICONS: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  MANUAL: { icon: Hand, label: '手动', color: 'text-muted-foreground' },
  PAYMENT: { icon: Inbox, label: '回款', color: 'text-blue-500' },
  SUBSCRIPTION: { icon: RefreshCw, label: '订阅', color: 'text-violet-500' },
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

const DIRECTION_FILTERS = [
  { value: '', label: '全部' },
  { value: 'INCOME', label: '收入' },
  { value: 'EXPENSE', label: '支出' },
];

const inputCls = 'w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200';

/* ── 单条流水 ── */
function TransactionRow({ tx }: { tx: Transaction }) {
  const [hovered, setHovered] = useState(false);
  const deleteTx = useDeleteTransaction();
  const isIncome = tx.direction === 'INCOME';
  const sourceInfo = SOURCE_ICONS[tx.source] || SOURCE_ICONS.MANUAL;
  const SourceIcon = sourceInfo.icon;
  const projectName = tx.project?.name || tx.payment?.project?.name;
  const taskTitle = tx.task?.title;

  return (
    <div
      className="group flex items-center gap-4 rounded-xl px-4 py-3.5 transition-colors hover:bg-muted/40"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 方向图标 */}
      <div className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
        isIncome ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-rose-50 dark:bg-rose-950/40',
      )}>
        {isIncome
          ? <ArrowDownLeft className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          : <ArrowUpRight className="h-5 w-5 text-rose-600 dark:text-rose-400" />}
      </div>

      {/* 信息 */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {/* 行标题：text-sm font-medium text-foreground/80，和 TaskList 一致 */}
          <span className="text-sm font-medium text-foreground/80">{tx.description}</span>
          {/* 类别标签：text-[11px] font-medium，和 StatusBadge 一致 */}
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
            CATEGORY_COLORS[tx.category] || 'bg-muted text-muted-foreground')}>
            {CATEGORY_LABELS[tx.category] || tx.category}
          </span>
          {/* 来源标记：text-[10px] font-medium，和 Dashboard badge 一致 */}
          {tx.source !== 'MANUAL' && (
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
              tx.source === 'PAYMENT' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                : 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400')}>
              <SourceIcon className="h-2.5 w-2.5" />
              {sourceInfo.label}
            </span>
          )}
        </div>
        {/* 元信息：text-[11px] text-muted-foreground，和 TaskList 描述行一致 */}
        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>{formatTime(tx.date)}</span>
          {projectName && (
            <span className="flex items-center gap-1">
              <FolderKanban className="h-3 w-3" />{projectName}
            </span>
          )}
          {taskTitle && (
            <span className="flex items-center gap-1">
              <CheckSquare className="h-3 w-3" />{taskTitle}
            </span>
          )}
        </div>
      </div>

      {/* 金额：font-mono tabular-nums，和 Reports 排行一致 */}
      <span className={cn(
        'shrink-0 font-mono text-sm font-medium tabular-nums',
        isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground/80',
      )}>
        {isIncome ? '+' : '-'}¥{formatYuan(tx.amount)}
      </span>

      {/* 删除 */}
      {tx.source === 'MANUAL' && hovered && (
        <button onClick={() => deleteTx.mutate(tx.id)}
          className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/* ── 日期分组 ── */
function DateGroup({ date, transactions }: { date: string; transactions: Transaction[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const dayTotal = transactions.reduce((s, tx) => s + (tx.direction === 'INCOME' ? tx.amount : -tx.amount), 0);

  return (
    <div className="mb-2">
      <button onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-left transition-colors hover:bg-muted/50">
        {collapsed
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />}
        {/* 日期标题：text-sm font-medium text-foreground，和 CardTitle 一致 */}
        <span className="text-sm font-medium text-foreground">{formatDate(date)}</span>
        <span className="text-[11px] text-muted-foreground">{transactions.length} 笔</span>
        {/* 当日合计：font-mono，和 Reports 数字一致 */}
        <span className={cn('ml-auto font-mono text-[13px] tabular-nums',
          dayTotal >= 0 ? 'text-emerald-600' : 'text-muted-foreground')}>
          {dayTotal >= 0 ? '+' : ''}¥{formatYuan(Math.abs(dayTotal))}
        </span>
      </button>
      {!collapsed && (
        <div className="mt-0.5 space-y-0.5 pl-2">
          {transactions.map((tx) => <TransactionRow key={tx.id} tx={tx} />)}
        </div>
      )}
    </div>
  );
}

/* ── 主组件 ── */
export function TransactionTab() {
  const [page, setPage] = useState(1);
  const [direction, setDirection] = useState('');
  const [source, setSource] = useState('');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formDirection, setFormDirection] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');

  const { data, isLoading } = useTransactions({
    page, limit: 30,
    ...(direction ? { direction } : {}),
    ...(source ? { source } : {}),
    ...(search ? { search } : {}),
  });

  const grouped = data?.data.reduce<Record<string, Transaction[]>>((acc, tx) => {
    const d = new Date(tx.date).toDateString();
    (acc[d] ??= []).push(tx);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4">
      {/* ── 工具栏 ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* 左：方向筛选 — text-xs font-medium，和 Reports toggle 一致 */}
        <div className="flex h-9 items-center gap-0.5 rounded-lg border border-border/60 bg-card p-0.5">
          {DIRECTION_FILTERS.map((opt) => (
            <button key={opt.value}
              onClick={() => { setDirection(opt.value); setPage(1); }}
              className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150',
                direction === opt.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:bg-accent')}>
              {opt.label}
            </button>
          ))}
        </div>

        {/* 来源下拉 — inputCls */}
        <select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }}
          className="h-9 rounded-lg border border-border px-3.5 text-sm text-foreground/80 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200">
          <option value="">全部来源</option>
          <option value="MANUAL">手动录入</option>
          <option value="PAYMENT">回款触发</option>
          <option value="SUBSCRIPTION">订阅自动</option>
        </select>

        {/* 搜索 */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input placeholder="搜索描述或备注..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className={cn(inputCls, 'pl-9 h-9')} />
        </div>

        {/* 右：操作按钮 — text-sm font-medium，和 TaskForm 按钮一致 */}
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={() => { setFormDirection('INCOME'); setFormOpen(true); }}
            className="gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 active:scale-95">
            <Plus className="h-4 w-4" />记收入
          </Button>
          <Button variant="outline" onClick={() => { setFormDirection('EXPENSE'); setFormOpen(true); }}
            className="gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground/70 hover:bg-muted">
            <Plus className="h-4 w-4" />记支出
          </Button>
        </div>
      </div>

      {/* ── 列表 ── */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !grouped || Object.keys(grouped).length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground empty-float">
            <ReceiptText className="h-12 w-12 opacity-20" />
            <p className="text-sm font-medium">还没有流水记录</p>
            <p className="text-xs text-muted-foreground/60">点击右上角按钮开始记账</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30 p-3">
            {Object.entries(grouped).map(([_, txs]) => (
              <DateGroup key={txs[0].date} date={txs[0].date} transactions={txs} />
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

      <TransactionForm open={formOpen} onOpenChange={setFormOpen} defaultDirection={formDirection} />
    </div>
  );
}
