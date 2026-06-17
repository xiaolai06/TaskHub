'use client';

import { useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import { ChartPopover } from './ChartPopover';

interface DonutData {
  label: string;
  value: number;
  color: string;
  detail?: ReactNode;
}

interface DonutChartProps {
  data: DonutData[];
  centerLabel?: string;
  centerValue?: string;
  size?: number;
  formatValue?: (v: number) => string;
}

export function DonutChart({
  data, centerLabel, centerValue, size = 190, formatValue,
}: DonutChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - 20) / 2;
  const circ = 2 * Math.PI * r;
  const fmt = formatValue ?? ((v: number) => String(v));

  const arcs = useMemo(() => data.map((d) => {
    const pct = (d.value / total) * 100;
    return { ...d, pct, dash: (pct / 100) * circ };
  }), [data, total, circ]);

  // 前缀和，避免 render 中 O(n²)
  const offsets = useMemo(() => {
    const result: number[] = [0];
    for (let i = 0; i < arcs.length - 1; i++) {
      result.push(result[i] + arcs[i].dash);
    }
    return result;
  }, [arcs]);

  return (
    <div className="flex flex-col items-center gap-5">
      {/* 环形图 — 水平居中 */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
          {arcs.map((arc, i) => (
            <circle key={`${arc.label}-${i}`} cx={size / 2} cy={size / 2} r={r}
              fill="none" stroke={arc.color} strokeWidth={hovered === i ? '16' : '12'}
              strokeDasharray={`${arc.dash} ${circ - arc.dash}`} strokeDashoffset={-offsets[i]}
              strokeLinecap="round" className="cursor-pointer transition-all duration-200"
              style={{ opacity: hovered === null || hovered === i ? 1 : 0.2 }}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} />
          ))}
          {total === 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth="12" />}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold tabular-nums text-foreground leading-tight">
            {hovered !== null ? fmt(data[hovered].value) : centerValue ?? fmt(total)}
          </span>
          <span className="text-xs text-muted-foreground mt-1">
            {hovered !== null ? data[hovered].label : centerLabel ?? ''}
          </span>
        </div>
      </div>

      {/* 图例 — 底部横排 */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {arcs.map((arc, i) => {
          const legendItem = (
            <div
              className="flex items-center gap-2 rounded-md px-2 py-1 cursor-pointer transition-colors"
              style={{ backgroundColor: hovered === i ? `${arc.color}10` : 'transparent' }}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: arc.color }} />
              <span className="text-xs text-foreground/70">{arc.label}</span>
              <span className="text-xs font-mono font-semibold tabular-nums text-foreground">{fmt(arc.value)}</span>
              <span className="text-[10px] font-mono text-muted-foreground">{arc.pct.toFixed(1)}%</span>
            </div>
          );

          if (!arc.detail) return <div key={`${arc.label}-${i}`}>{legendItem}</div>;

          return (
            <ChartPopover key={`${arc.label}-${i}`} content={arc.detail}>
              {legendItem}
            </ChartPopover>
          );
        })}
      </div>
    </div>
  );
}
