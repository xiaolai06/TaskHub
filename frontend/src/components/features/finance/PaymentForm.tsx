'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useCreatePayment, type CreatePaymentInput } from '@/hooks/usePayments';
import { useProjectList } from '@/hooks/useProjects';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';
import { CustomSelect } from '@/components/ui/custom-select';

const PAYMENT_TYPES = [
  { value: 'DOWN_PAYMENT', label: '预付款' },
  { value: 'PROGRESS', label: '进度款' },
  { value: 'FINAL', label: '尾款' },
  { value: 'ADJUSTMENT', label: '调整项' },
  { value: 'OTHER', label: '其他' },
];

const PAYMENT_METHODS = [
  { value: 'BANK_TRANSFER', label: '银行转账' },
  { value: 'ALIPAY', label: '支付宝' },
  { value: 'WECHAT', label: '微信' },
  { value: 'CASH', label: '现金' },
  { value: 'OTHER', label: '其他' },
];

interface PaymentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  projectName?: string;
}

export function PaymentForm({ open, onOpenChange, projectId, projectName }: PaymentFormProps) {
  const [selectedProjectId, setSelectedProjectId] = useState(projectId || '');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('DOWN_PAYMENT');
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  const createPayment = useCreatePayment();
  const { data: projectsData } = useProjectList();

  useEffect(() => {
    if (open) {
      setSelectedProjectId(projectId || '');
      setAmount('');
      setType('DOWN_PAYMENT');
      setMethod('BANK_TRANSFER');
      setReceivedAt(new Date().toISOString().slice(0, 10));
      setNote('');
    }
  }, [open, projectId]);

  const handleSubmit = () => {
    if (!selectedProjectId || !amount || !receivedAt) return;
    const data: CreatePaymentInput = {
      amount: Math.round(Number(amount) * 100),
      type,
      method,
      receivedAt,
      projectId: selectedProjectId,
      note: note || undefined,
    };
    createPayment.mutate(data, {
      onSuccess: () => onOpenChange(false),
    });
  };

  const projects = projectsData?.data || [];
  const isValid = selectedProjectId && amount && Number(amount) > 0 && receivedAt;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col max-h-[90vh] p-0">
        <DialogHeader>
          <DialogTitle>录入回款</DialogTitle>
          <DialogDescription>
            记录客户项目回款，会自动同步到流水记录
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-4 py-4">
          {/* Project */}
          <div className="space-y-1.5">
            <Label className="text-xs">项目 *</Label>
            {projectName ? (
              <div className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">{projectName}</div>
            ) : (
              <CustomSelect
                value={selectedProjectId}
                options={[{ value: '', label: '选择项目...' }, ...projects.map(p => ({ value: p.id, label: p.name }))]}
                onChange={setSelectedProjectId}
              />
            )}
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label className="text-xs">金额（元）*</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">¥</span>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7 font-mono text-lg"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label className="text-xs">回款类型 *</Label>
            <div className="flex flex-wrap gap-1.5">
              {PAYMENT_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                    type === t.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Received Date */}
          <div className="space-y-1.5">
            <Label className="text-xs">到账日期 *</Label>
            <DatePicker value={receivedAt} onChange={setReceivedAt} />
          </div>

          {/* Method */}
          <div className="space-y-1.5">
            <Label className="text-xs">到账方式</Label>
            <div className="flex flex-wrap gap-1.5">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMethod(m.value)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                    method === m.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400'
                      : 'border-border text-muted-foreground hover:border-blue-300',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label className="text-xs">备注</Label>
            <Input
              placeholder="可选备注..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || createPayment.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {createPayment.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            确认录入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
