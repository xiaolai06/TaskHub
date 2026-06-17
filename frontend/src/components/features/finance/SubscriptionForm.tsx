'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  useCreateSubscription, useUpdateSubscription,
  type CreateSubscriptionInput, type Subscription,
} from '@/hooks/useSubscriptions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';
import { CustomSelect } from '@/components/ui/custom-select';

const CATEGORIES = [
  { value: 'SOFTWARE', label: 'AI/软件' },
  { value: 'CLOUD', label: '云服务' },
  { value: 'DOMAIN', label: '域名/托管' },
  { value: 'TOOL', label: '效率工具' },
  { value: 'MEDIA', label: '素材库' },
  { value: 'OTHER', label: '其他' },
];

const CYCLES = [
  { value: 'MONTHLY', label: '月付' },
  { value: 'QUARTERLY', label: '季付' },
  { value: 'YEARLY', label: '年付' },
];

const CURRENCIES = [
  { value: 'CNY', label: 'CNY ¥' },
  { value: 'USD', label: 'USD $' },
  { value: 'EUR', label: 'EUR €' },
];

interface SubscriptionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription?: Subscription;
}

export function SubscriptionForm({ open, onOpenChange, subscription }: SubscriptionFormProps) {
  const isEdit = !!subscription;

  const [name, setName] = useState('');
  const [category, setCategory] = useState('SOFTWARE');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('CNY');
  const [exchangeRate, setExchangeRate] = useState('7.0');
  const [cycle, setCycle] = useState('MONTHLY');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [nextBillingAt, setNextBillingAt] = useState('');
  const [autoRenew, setAutoRenew] = useState(true);
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');

  const createSub = useCreateSubscription();
  const updateSub = useUpdateSubscription();

  useEffect(() => {
    if (open) {
      if (subscription) {
        setName(subscription.name);
        setCategory(subscription.category);
        setAmount(String(subscription.amount / 100));
        setCurrency(subscription.currency);
        setExchangeRate(String(subscription.exchangeRate));
        setCycle(subscription.cycle);
        setStartDate(subscription.startDate.slice(0, 10));
        setNextBillingAt(subscription.nextBillingAt.slice(0, 10));
        setAutoRenew(subscription.autoRenew);
        setUrl(subscription.url || '');
        setNote(subscription.note || '');
      } else {
        setName('');
        setCategory('SOFTWARE');
        setAmount('');
        setCurrency('CNY');
        setExchangeRate('7.0');
        setCycle('MONTHLY');
        setStartDate(new Date().toISOString().slice(0, 10));
        setNextBillingAt('');
        setAutoRenew(true);
        setUrl('');
        setNote('');
      }
    }
  }, [open, subscription]);

  const handleSubmit = () => {
    if (!name || !amount || !nextBillingAt) return;

    const data: CreateSubscriptionInput = {
      name,
      category,
      amount: Math.round(Number(amount) * 100),
      currency,
      exchangeRate: currency === 'CNY' ? 1.0 : Number(exchangeRate),
      cycle,
      startDate,
      nextBillingAt,
      autoRenew,
      url: url || undefined,
      note: note || undefined,
    };

    if (isEdit && subscription) {
      updateSub.mutate({ id: subscription.id, data }, {
        onSuccess: () => onOpenChange(false),
      });
    } else {
      createSub.mutate(data, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  const isValid = name && amount && Number(amount) > 0 && nextBillingAt;
  const isPending = createSub.isPending || updateSub.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col max-h-[90vh] p-0">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑订阅' : '添加订阅'}</DialogTitle>
          <DialogDescription>
            {isEdit ? '修改订阅信息' : '登记一个会定期扣费的服务'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-4 py-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs">服务名称 *</Label>
            <Input
              placeholder="如：ChatGPT Plus"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-xs">类别 *</Label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                    category === cat.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40',
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Amount + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">每期金额 *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : '€'}
                </span>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-7 font-mono"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">币种</Label>
              <CustomSelect
                value={currency}
                options={CURRENCIES.map(c => ({ value: c.value, label: c.label }))}
                onChange={setCurrency}
              />
            </div>
          </div>

          {/* Exchange Rate (non-CNY only) */}
          {currency !== 'CNY' && (
            <div className="space-y-1.5">
              <Label className="text-xs">汇率（1 {currency} = ? CNY）</Label>
              <Input
                type="number"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                className="font-mono text-sm"
                min="0"
                step="0.01"
              />
            </div>
          )}

          {/* Cycle */}
          <div className="space-y-1.5">
            <Label className="text-xs">扣费周期 *</Label>
            <div className="flex gap-1.5">
              {CYCLES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCycle(c.value)}
                  className={cn(
                    'flex-1 rounded-lg border py-2 text-xs font-medium transition-colors',
                    cycle === c.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40',
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">首次订阅</Label>
              <DatePicker value={startDate} onChange={setStartDate} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">下次扣费 *</Label>
              <DatePicker value={nextBillingAt} onChange={setNextBillingAt} />
            </div>
          </div>

          {/* Auto Renew */}
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-foreground">自动续费</p>
              <p className="text-2xs-plus text-muted-foreground">到期时自动创建支出记录</p>
            </div>
            <button
              onClick={() => setAutoRenew(!autoRenew)}
              className={cn(
                'relative h-5 w-9 rounded-full transition-colors',
                autoRenew ? 'bg-primary' : 'bg-muted',
              )}
            >
              <span className={cn(
                'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                autoRenew ? 'left-[18px]' : 'left-0.5',
              )} />
            </button>
          </div>

          {/* URL */}
          <div className="space-y-1.5">
            <Label className="text-xs">官网</Label>
            <Input
              type="url"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label className="text-xs">备注</Label>
            <Input
              placeholder="账号、用途等..."
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
            disabled={!isValid || isPending}
          >
            {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {isEdit ? '保存修改' : '添加订阅'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
