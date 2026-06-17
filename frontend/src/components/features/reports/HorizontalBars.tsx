'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChartPopover } from './ChartPopover';

interface HorizontalBarData {
  label: string;
  value: number;
  color: string;
  tag?: string;
  detail?: ReactNode;
}

interface HorizontalBarsProps {
  data: HorizontalBarData[];
  formatValue?: (v: number) => string;
  emptyText?: string;
}

export function HorizontalBars({
  data, formatValue, emptyText = '暂无数据',
}: HorizontalBarsProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (data.length === 0) return <p className="py-8 text-center text-xs text-muted-foreground">{emptyText}</p>;

  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  const fmt = formatValue ?? ((v: number) => String(Math.round(v)));

  return (
    <div className="space-y-3">
      {data.map((d, i) => {
        const pct = Math.max(2, (Math.abs(d.value) / max) * 100);

        const barContent = (
          <div
            className="relative"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-foreground/80 truncate mr-2">{d.label}</span>
              <div className="flex items-center gap-2 shrink-0">
                {d.tag && <span className="text-[10px] text-muted-foreground">{d.tag}</span>}
                <span className="text-xs font-mono font-semibold tabular-nums text-foreground">{fmt(d.value)}</span>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted/50">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${pct}%`,
                  backgroundColor: d.color,
                  opacity: hovered === null || hovered === i ? 1 : 0.3,
                }}
              />
            </div>
          </div>
        );

        if (!d.detail) return <div key={i}>{barContent}</div>;

        return (
          <ChartPopover key={i} content={d.detail}>
            {barContent}
          </ChartPopover>
        );
      })}
    </div>
  );
}
