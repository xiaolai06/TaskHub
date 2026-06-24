'use client';

import { cn } from '@/lib/utils';
import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import type { CreateCustomerInput, Customer } from '@/hooks/useCustomers';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';

// ─── Zod Schema ───────────────────────────────────────────

const customerFormSchema = z.object({
  name: z.string().min(1, '客户名称不能为空').max(100, '名称不超过100字'),
  company: z.string().optional(),
  email: z.string().email('邮箱格式不正确').optional().or(z.literal('')),
  phone: z.string().optional(),
  industry: z.string().optional(),
  status: z.enum(['ACTIVE', 'VIP', 'INACTIVE', 'LEAD']),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type CustomerFormValues = z.infer<typeof customerFormSchema>;

// ─── Helpers & Constants ──────────────────────────────────

const statusOptions = [
  { value: 'ACTIVE', label: '合作中' },
  { value: 'VIP', label: '重点客户' },
  { value: 'LEAD', label: '待跟进' },
  { value: 'INACTIVE', label: '已暂停' },
];

const inputCls = 'w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60';
const labelCls = 'mb-1.5 block text-sm font-medium text-foreground/80';

// ─── Props ────────────────────────────────────────────────

interface CustomerFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateCustomerInput) => void;
  isLoading?: boolean;
  editCustomer?: Customer | null;
}

// ─── Component ────────────────────────────────────────────

export function CustomerForm({ open, onClose, onSubmit, isLoading, editCustomer }: CustomerFormProps) {
  const isEdit = !!editCustomer;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: '',
      company: '',
      email: '',
      phone: '',
      industry: '',
      status: 'ACTIVE',
      address: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    if (editCustomer) {
      reset({
        name: editCustomer.name,
        company: editCustomer.company || '',
        email: editCustomer.email || '',
        phone: editCustomer.phone || '',
        industry: editCustomer.industry || '',
        status: (editCustomer.status as CustomerFormValues['status']) || 'ACTIVE',
        address: editCustomer.address || '',
        notes: editCustomer.notes || '',
      });
    } else {
      reset({
        name: '',
        company: '',
        email: '',
        phone: '',
        industry: '',
        status: 'ACTIVE',
        address: '',
        notes: '',
      });
    }
  }, [open, editCustomer, reset]);

  function onFormSubmit(data: CustomerFormValues) {
    onSubmit({
      name: data.name.trim(),
      company: data.company?.trim() || undefined,
      email: data.email?.trim() || undefined,
      phone: data.phone?.trim() || undefined,
      industry: data.industry?.trim() || undefined,
      status: data.status,
      address: data.address?.trim() || undefined,
      notes: data.notes?.trim() || undefined,
    });
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="flex flex-col max-h-[90vh] p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{isEdit ? '编辑客户' : '添加客户'}</DialogTitle>
          <DialogDescription>{isEdit ? '修改客户信息后将实时更新' : '填写客户信息后添加'}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-4">
              <div>
                <label htmlFor="customer-name" className={labelCls}>客户名称 <span className="text-red-500">*</span></label>
                <input id="customer-name" type="text" {...register('name')} placeholder="输入客户名称" className={inputCls} />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="customer-status" className={labelCls}>客户状态</label>
                  <Controller
                    control={control}
                    name="status"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className={cn(inputCls, 'w-full')}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div>
                  <label htmlFor="customer-industry" className={labelCls}>所属行业</label>
                  <input id="customer-industry" type="text" {...register('industry')} placeholder="如：互联网、制造业" className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="customer-company" className={labelCls}>公司</label>
                  <input id="customer-company" type="text" {...register('company')} placeholder="公司名称" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="customer-email" className={labelCls}>邮箱</label>
                  <input id="customer-email" type="email" {...register('email')} placeholder="email@example.com" className={inputCls} />
                  {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="customer-phone" className={labelCls}>电话</label>
                  <input id="customer-phone" type="text" {...register('phone')} placeholder="联系电话" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="customer-address" className={labelCls}>地址</label>
                  <input id="customer-address" type="text" {...register('address')} placeholder="客户地址" className={inputCls} />
                </div>
              </div>

              <div>
                <label htmlFor="customer-notes" className={labelCls}>备注</label>
                <textarea id="customer-notes" {...register('notes')} placeholder="关于客户的重要信息，如决策人、合作偏好等" rows={3}
                  className="w-full resize-none rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
            <button type="button" onClick={handleClose}
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted">取消</button>
            <button type="submit" disabled={isLoading}
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
