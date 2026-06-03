'use client';

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { CreateCustomerInput, Customer } from '@/hooks/useCustomers';

const statusOptions = [
  { value: 'ACTIVE', label: '合作中' },
  { value: 'VIP', label: '重点客户' },
  { value: 'LEAD', label: '待跟进' },
  { value: 'INACTIVE', label: '已暂停' },
];

interface CustomerFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateCustomerInput) => void;
  isLoading?: boolean;
  editCustomer?: Customer | null;
}

export function CustomerForm({ open, onClose, onSubmit, isLoading, editCustomer }: CustomerFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [address, setAddress] = useState('');
  const [industry, setIndustry] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [notes, setNotes] = useState('');

  const isEdit = !!editCustomer;

  useEffect(() => {
    if (editCustomer) {
      setName(editCustomer.name);
      setEmail(editCustomer.email || '');
      setPhone(editCustomer.phone || '');
      setCompany(editCustomer.company || '');
      setAddress(editCustomer.address || '');
      setIndustry(editCustomer.industry || '');
      setStatus(editCustomer.status || 'ACTIVE');
      setNotes(editCustomer.notes || '');
    } else {
      reset();
    }
  }, [editCustomer]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      company: company.trim() || undefined,
      address: address.trim() || undefined,
      industry: industry.trim() || undefined,
      status,
      notes: notes.trim() || undefined,
    });
  }

  function reset() {
    setName(''); setEmail(''); setPhone('');
    setCompany(''); setAddress(''); setIndustry('');
    setStatus('ACTIVE'); setNotes('');
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl">
          {/* 头部 */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="text-base font-semibold text-foreground">{isEdit ? '编辑客户' : '添加客户'}</h2>
            <button onClick={() => { reset(); onClose(); }} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground/70">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="max-h-[70vh] overflow-y-auto px-6 py-5">
            <div className="space-y-4">
              {/* 客户名称 */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground/80">客户名称 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="输入客户名称"
                  className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none transition-colors placeholder:text-muted-foreground focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
                  required
                />
              </div>

              {/* 状态 + 行业 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground/80">客户状态</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground/80">所属行业</label>
                  <input
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="如：互联网、制造业"
                    className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none transition-colors placeholder:text-muted-foreground focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
                  />
                </div>
              </div>

              {/* 公司 + 邮箱 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground/80">公司</label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="公司名称"
                    className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none transition-colors placeholder:text-muted-foreground focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground/80">邮箱</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none transition-colors placeholder:text-muted-foreground focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
                  />
                </div>
              </div>

              {/* 电话 + 地址 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground/80">电话</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="联系电话"
                    className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none transition-colors placeholder:text-muted-foreground focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground/80">地址</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="客户地址"
                    className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none transition-colors placeholder:text-muted-foreground focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
                  />
                </div>
              </div>

              {/* 备注 */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground/80">备注</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="关于客户的重要信息，如决策人、合作偏好、特殊要求等"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none transition-colors placeholder:text-muted-foreground focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
                />
              </div>
            </div>

            {/* 按钮 */}
            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => { reset(); onClose(); }}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isLoading || !name.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEdit ? '保存修改' : '添加客户'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
