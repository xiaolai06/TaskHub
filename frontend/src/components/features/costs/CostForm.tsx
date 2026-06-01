'use client';

import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import type { CreateCostInput } from '@/hooks/useCosts';

const categories = [
  { value: 'LABOR', label: '人工' },
  { value: 'MATERIAL', label: '材料' },
  { value: 'OVERHEAD', label: '运营' },
  { value: 'OTHER', label: '其他' },
];

interface CostFormProps {
  onSubmit: (data: CreateCostInput) => void;
  isLoading?: boolean;
}

export function CostForm({ onSubmit, isLoading }: CostFormProps) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!amount || !description.trim()) return;
    onSubmit({
      amount: Math.round(Number(amount) * 100),
      category,
      description: description.trim(),
      date,
    });
    setAmount('');
    setCategory('OTHER');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-[120px_120px_1fr_120px_auto] gap-2">
      <input
        type="number"
        min="0"
        step="0.01"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        placeholder="成本金额"
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300"
      />
      <select
        value={category}
        onChange={(event) => setCategory(event.target.value)}
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300"
      >
        {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      <input
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="成本说明，如外包、服务器、素材"
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300"
      />
      <input
        type="date"
        value={date}
        onChange={(event) => setDate(event.target.value)}
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300"
      />
      <button
        type="submit"
        disabled={isLoading || !amount || !description.trim()}
        className="flex h-10 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white disabled:opacity-50"
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        添加
      </button>
    </form>
  );
}
