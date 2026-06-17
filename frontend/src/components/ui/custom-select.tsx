'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomSelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  options: CustomSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function CustomSelect({ value, options, onChange, placeholder = '请选择', className }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const selected = options.find(o => o.value === value);

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'relative flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border bg-card pl-3 pr-7 text-xs transition-all',
          open
            ? 'border-indigo-400 ring-2 ring-indigo-200/60'
            : 'border-border/80 hover:border-indigo-300',
        )}
      >
        <span className={cn(selected ? 'text-foreground/80' : 'text-muted-foreground/60')}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown className={cn('pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 max-h-60 min-w-fit overflow-auto rounded-xl border border-indigo-100 bg-popover py-1 shadow-xl shadow-indigo-100/40">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={cn(
                'flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-xs transition-colors',
                value === opt.value
                  ? 'bg-indigo-50 text-indigo-600 font-medium'
                  : 'text-foreground/80 hover:bg-accent',
              )}
            >
              <span>{opt.label}</span>
              {value === opt.value && <Check className="h-3 w-3 shrink-0 ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
