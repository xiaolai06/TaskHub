'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ChartPopover } from './ChartPopover';

interface VerticalBarData {
  name: string;
  value: number;
  color: string;
  tag?: string;
  tagPositive?: boolean;
  detail?: ReactNode;
}

interface VerticalBarsProps {
  data: VerticalBarData[];
  formatValue?: (v: number) => string;
  maxHeight?: number;
  emptyText?: string;
}

export function VerticalBars({
  data, formatValue, maxHeight = 160, emptyText = '暂无数据',
}: VerticalBarsProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (data.length === 0) return <p className="py-8 text-center text-xs text-muted-foreground">{emptyText}</p>;

  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  const fmt = formatValue ?? ((v: number) => String(Math.round(v)));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-center gap-2" style={{ height: maxHeight }}>
        {data.slice(0, 8).map((d, i) => {
          const h = Math.max(4, (Math.abs(d.value) / max) * (maxHeight - 30));
          const barContent = (
            <div
              className="relative flex flex-1 flex-col items-center gap-1.5"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="flex w-full justify-center">
                <div className="w-full max-w-[40px] rounded-t-md transition-all duration-300"
                  style={{
                    height: h,
                    backgroundColor: d.color,
                    opacity: hovered === null || hovered === i ? 1 : 0.3,
                  }} />
              </div>
              <span className="w-full truncate text-center text-[10px] leading-tight text-muted-foreground">{d.name}</span>
            </div>
          );

          if (!d.detail) return <div key={i} className="flex flex-1 flex-col items-center">{barContent}</div>;

          return (
            <ChartPopover key={i} content={d.detail}>
              {barContent}
            </ChartPopover>
          );
        })}
      </div>
      {data.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-border/40 pt-2.5">
          {data.slice(0, 8).map((d, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[10px] cursor-pointer"
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
              style={{ opacity: hovered === null || hovered === i ? 1 : 0.4 }}>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="text-muted-foreground">{d.name}</span>
              {d.tag && (
                <span className={cn('font-mono font-semibold', d.tagPositive === false ? 'text-red-500' : 'text-emerald-600')}>{d.tag}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
