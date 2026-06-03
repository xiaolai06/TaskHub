'use client';

import { useState, useDeferredValue, useMemo } from 'react';
import { CalendarDays, Users, Star, Zap, Target, Search, Plus } from 'lucide-react';
import { useCustomerList, useCreateCustomer, useUpdateCustomer, useDeleteCustomer } from '@/hooks/useCustomers';
import { CustomerList } from '@/components/features/customers/CustomerList';
import type { CreateCustomerInput } from '@/hooks/useCustomers';

const statusFilters = [
  { key: '', label: '全部' },
  { key: 'ACTIVE', label: '合作中' },
  { key: 'VIP', label: '重点客户' },
  { key: 'LEAD', label: '待跟进' },
  { key: 'INACTIVE', label: '已暂停' },
];

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [formCloseTrigger, setFormCloseTrigger] = useState(0);
  const [formOpenTrigger, setFormOpenTrigger] = useState(0);

  const deferredSearch = useDeferredValue(search);

  const { data, isLoading, error } = useCustomerList({
    search: deferredSearch || undefined,
    status: statusFilter || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });
  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();
  const deleteMutation = useDeleteCustomer();

  const stats = useMemo(() => {
    const customers = data?.data ?? [];
    return {
      total: data?.total ?? 0,
      active: customers.filter((c) => c.status === 'ACTIVE').length,
      vip: customers.filter((c) => c.status === 'VIP').length,
      lead: customers.filter((c) => c.status === 'LEAD').length,
    };
  }, [data]);

  function handleCreate(input: CreateCustomerInput) {
    createMutation.mutate(input, { onSuccess: () => setFormCloseTrigger((n) => n + 1) });
  }
  function handleUpdate(id: string, input: CreateCustomerInput) {
    updateMutation.mutate({ id, data: input }, { onSuccess: () => setFormCloseTrigger((n) => n + 1) });
  }
  function handleDelete(id: string) { deleteMutation.mutate(id); }
  function clearDateFilter() { setStartDate(''); setEndDate(''); }

  return (
    <div className="flex flex-col gap-4">
      {/* ── 统计卡片 ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: Users, label: '总客户', value: stats.total, color: 'text-indigo-500', bg: 'bg-indigo-50' },
          { icon: Zap, label: '合作中', value: stats.active, color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { icon: Star, label: '重点客户', value: stats.vip, color: 'text-amber-500', bg: 'bg-amber-50' },
          { icon: Target, label: '待跟进', value: stats.lead, color: 'text-blue-500', bg: 'bg-blue-50' },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3.5 shadow-sm">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.bg}`}>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── 操作栏（一行：筛选 + 搜索 + 添加） ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* 状态筛选 */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5">
          {statusFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                statusFilter === f.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* 时间范围 */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border-none bg-transparent text-xs text-foreground/70 outline-none" />
          <span className="text-xs text-muted-foreground/50">至</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border-none bg-transparent text-xs text-foreground/70 outline-none" />
          {(startDate || endDate) && (
            <button onClick={clearDateFilter} className="ml-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">清除</button>
          )}
        </div>

        {/* 搜索框 */}
        <div className="relative min-w-[200px] max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索客户..."
            className="w-full rounded-lg border border-border py-2 pl-9 pr-3 text-sm text-foreground/80 outline-none transition-colors placeholder:text-muted-foreground focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
          />
        </div>

        {/* 添加客户 */}
        <button
          onClick={() => setFormOpenTrigger((n) => n + 1)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-700 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          添加客户
        </button>

        <span className="ml-auto text-xs text-muted-foreground">共 {stats.total} 个客户</span>
      </div>

      {/* ── 内容区 ── */}
      <CustomerList
        customers={data?.data ?? []}
        isLoading={isLoading}
        error={!!error}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        createLoading={createMutation.isPending}
        updateLoading={updateMutation.isPending}
        total={data?.total ?? 0}
        formCloseTrigger={formCloseTrigger}
        formOpenTrigger={formOpenTrigger}
      />
    </div>
  );
}
