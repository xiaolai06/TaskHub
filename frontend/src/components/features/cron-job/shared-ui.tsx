'use client';

import { cn } from '@/lib/utils';
import { CheckCircle } from 'lucide-react';
import type { WH } from './cron-utils';

// ═══ 开关 ═══

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      className={cn('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors', on ? 'bg-indigo-600' : 'bg-accent')}>
      <span className={cn('h-4 w-4 rounded-full bg-card shadow transition-transform', on ? 'translate-x-4' : 'translate-x-0.5')} />
    </button>
  );
}

// ═══ 通知渠道行 ═══

export function NRow({ icon, label, sub, children }: { icon: React.ReactNode; label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm shrink-0">{icon}</span>
        <span className="text-sm text-foreground/80">{label}</span>
        {sub && <span className="text-2xs-plus text-muted-foreground/50">{sub}</span>}
      </div>
      {children}
    </div>
  );
}

// ═══ 渠道选择器 ═══

export interface ChannelOption {
  key: string;
  icon: string;
  label: string;
  sub?: string;
  configured: boolean;
}

interface ChannelSelectorProps {
  channels: ChannelOption[];
  selected: string[];
  onChange: (keys: string[]) => void;
  emailEnabled?: boolean;
  onEmailToggle?: (v: boolean) => void;
  compact?: boolean;
}

export function ChannelSelector({ channels, selected, onChange, emailEnabled, onEmailToggle, compact }: ChannelSelectorProps) {
  const toggleChannel = (key: string) => {
    onChange(selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key]);
  };

  if (compact) {
    // 紧凑模式：只显示图标勾选
    return (
      <div className="flex items-center gap-2">
        {onEmailToggle && (
          <button type="button" onClick={() => onEmailToggle(!emailEnabled)}
            className={cn('flex items-center gap-1 rounded-md border px-2 py-1 text-2xs transition-all',
              emailEnabled ? 'border-indigo-300 bg-indigo-50 text-indigo-600' : 'border-border text-muted-foreground hover:border-indigo-200')}>
            📧 邮件 {emailEnabled && <CheckCircle className="h-3 w-3" />}
          </button>
        )}
        {channels.filter(c => c.configured).map(ch => (
          <button key={ch.key} type="button" onClick={() => toggleChannel(ch.key)}
            className={cn('flex items-center gap-1 rounded-md border px-2 py-1 text-2xs transition-all',
              selected.includes(ch.key) ? 'border-indigo-300 bg-indigo-50 text-indigo-600' : 'border-border text-muted-foreground hover:border-indigo-200')}>
            {ch.icon} {ch.label} {selected.includes(ch.key) && <CheckCircle className="h-3 w-3" />}
          </button>
        ))}
      </div>
    );
  }

  // 完整模式：列表行
  return (
    <div className="rounded-lg border border-border/60 bg-background divide-y divide-border/40">
      {onEmailToggle && (
        <NRow icon="📧" label="邮件通知" sub={emailEnabled ? '已开启' : '未开启'}>
          <Toggle on={!!emailEnabled} onChange={onEmailToggle} />
        </NRow>
      )}
      {channels.map(ch => (
        <NRow key={ch.key} icon={ch.icon} label={ch.label} sub={ch.sub}>
          {ch.configured ? (
            <input type="checkbox" checked={selected.includes(ch.key)} onChange={() => toggleChannel(ch.key)}
              className="h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500" />
          ) : (
            <span className="text-2xs text-muted-foreground/40">未配置</span>
          )}
        </NRow>
      ))}
    </div>
  );
}
