'use client';

import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import type { CreateCustomerInput, Customer } from '@/hooks/useCustomers';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';

const statusOptions = [
  { value: 'ACTIVE', label: '合作中' },
  { value: 'VIP', label: '重点客户' },
  { value: 'LEAD', label: '待跟进' },
  { value: 'INACTIVE', label: '已暂停' },
];

const inputCls = 'w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60';
const labelCls = 'mb-1.5 block text-sm font-medium text-foreground/80';

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
    if (!open) return;
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
  }, [open]);

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

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="flex flex-col max-h-[90vh] p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{isEdit ? '编辑客户' : '添加客户'}</DialogTitle>
          <DialogDescription>{isEdit ? '修改客户信息后将实时更新' : '填写客户信息后添加'}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-4">
              <div>
                <label className={labelCls}>客户名称 <span className="text-red-500">*</span></label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="输入客户名称" className={inputCls} required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>客户状态</label>
                  <Select value={status} onValueChange={(v) => setStatus(v || "ACTIVE")}>
                    <SelectTrigger className={cn(inputCls, "w-full")}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={labelCls}>所属行业</label>
                  <input type="text" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="如：互联网、制造业" className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>公司</label>
                  <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="公司名称" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>邮箱</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>电话</label>
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="联系电话" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>地址</label>
                  <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="客户地址" className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>备注</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="关于客户的重要信息，如决策人、合作偏好等" rows={3}
                  className="w-full resize-none rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
            <button type="button" onClick={() => { reset(); onClose(); }}
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted">取消</button>
            <button type="submit" disabled={isLoading || !name.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? '保存修改' : '添加客户'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
