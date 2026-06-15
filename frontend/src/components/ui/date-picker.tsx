'use client';

import * as React from 'react';
import { CalendarIcon, XIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

function parseDate(str: string | undefined): Date | undefined {
  if (!str) return undefined;
  const d = new Date(str + 'T00:00:00');
  return isNaN(d.getTime()) ? undefined : d;
}

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface DatePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function DatePicker({
  value,
  onChange,
  placeholder = '选择日期',
  disabled = false,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const date = React.useMemo(() => parseDate(value), [value]);
  const [month, setMonth] = React.useState<Date | undefined>(date);
  const [inputVal, setInputVal] = React.useState('');
  const [hovered, setHovered] = React.useState(false);

  React.useEffect(() => {
    setMonth(date);
  }, [date]);

  React.useEffect(() => {
    if (open) {
      setInputVal(value || '');
    }
  }, [open, value]);

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const d = parseDate(inputVal);
    if (d) {
      onChange?.(toISO(d));
      setMonth(d);
      setOpen(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          'flex h-9 w-40 shrink-0 items-center gap-2 rounded-lg border border-border/80 bg-card px-3 text-sm',
          'transition-all select-none',
          'hover:border-indigo-300 hover:bg-indigo-50/40',
          'focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-200/60 focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          !date ? 'text-muted-foreground' : 'text-foreground/80',
          className,
        )}
      >
        <CalendarIcon className="size-4 shrink-0 text-muted-foreground/70" />
        <span className="flex-1 truncate text-left text-[13px]">
          {date ? toISO(date) : placeholder}
        </span>
        {date && hovered && (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onChange?.('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                onChange?.('');
              }
            }}
            className="shrink-0 rounded p-0.5 text-muted-foreground/40 transition-colors hover:bg-muted hover:text-foreground"
          >
            <XIcon className="size-3" />
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={4}
        className="w-auto overflow-hidden rounded-xl border border-indigo-100 bg-popover shadow-2xl shadow-indigo-100/50"
      >
        <Calendar
          mode="single"
          selected={date}
          month={month}
          onMonthChange={setMonth}
          captionLayout="label"
          onSelect={(d) => {
            onChange?.(d ? toISO(d) : '');
            setOpen(false);
          }}
        />
        {/* 底部快捷输入区 */}
        <div className="flex items-center gap-2 border-t border-border px-3 py-2">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="输入日期 2026-01-15"
            className="h-7 flex-1 rounded-md border border-border bg-transparent px-2 text-xs text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
          />
          <button
            type="button"
            onClick={() => {
              const d = parseDate(inputVal);
              if (d) {
                onChange?.(toISO(d));
                setMonth(d);
                setOpen(false);
              }
            }}
            className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
          >
            确定
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { DatePicker, parseDate };
export type { DatePickerProps };
