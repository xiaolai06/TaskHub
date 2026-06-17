'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

export const CHART_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#f43f5e',
  '#06b6d4', '#8b5cf6', '#f97316', '#14b8a6',
];

interface TrendLine {
  label: string;
  color: string;
  values: number[];
}

interface TrendChartProps {
  labels: string[];
  lines: TrendLine[];
  formatValue?: (v: number) => string;
  emptyText?: string;
  details?: ReactNode[];
}

function niceMax(val: number): number {
  if (val <= 0) return 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(val)));
  const normalized = val / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

export function TrendChart({
  labels, lines, formatValue, emptyText = '暂无数据', details,
}: TrendChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });

  if (lines.length === 0 || labels.length === 0) {
    return <p className="py-8 text-center text-xs text-muted-foreground">{emptyText}</p>;
  }

  const W = 700, H = 220, PL = 56, PR = 20, PT = 12, PB = 36;
  const cW = W - PL - PR, cH = H - PT - PB;

  const allVals = lines.flatMap((l) => l.values);
  const dataMax = niceMax(Math.max(...allVals, 0));
  const dataMin = Math.min(0, ...allVals);
  const range = dataMax - dataMin || 1;

  const getX = (i: number) => PL + (labels.length <= 1 ? cW / 2 : (i / (labels.length - 1)) * cW);
  const getY = (v: number) => PT + ((dataMax - v) / range) * cH;

  const gridLines = 4;
  const gridVals = Array.from({ length: gridLines + 1 }, (_, i) => dataMin + (range / gridLines) * i);

  const fmt = formatValue ?? ((v: number) => {
    if (Math.abs(v) >= 10000) return `${(v / 10000).toFixed(1)}w`;
    if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return String(Math.round(v));
  });

  const updateTooltipPos = useCallback((idx: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const pxRatio = rect.width / W;
    const dotX = getX(idx) * pxRatio + rect.left;
    const dotY = PT * pxRatio + rect.top;
    setTooltipPos({ top: dotY - 8, left: dotX });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labels.length, dataMax, dataMin, range]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * W;
    const len = labels.length;
    let closest = 0, minDist = Infinity;
    for (let i = 0; i < len; i++) {
      const x = PL + (len <= 1 ? cW / 2 : (i / (len - 1)) * cW);
      const dist = Math.abs(mouseX - x);
      if (dist < minDist) { minDist = dist; closest = i; }
    }
    setHoverIdx(closest);
    updateTooltipPos(closest);
  }, [labels.length, cW, updateTooltipPos]);

  useEffect(() => {
    if (hoverIdx === null) return;
    const handler = () => updateTooltipPos(hoverIdx);
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [hoverIdx, updateTooltipPos]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full overflow-x-auto">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full cursor-crosshair"
          style={{ minWidth: 320, height: 'auto' }}
          onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIdx(null)}>
          {gridVals.map((v, i) => {
            const y = getY(v);
            return (
              <g key={i}>
                <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="currentColor" className="text-border/40" strokeWidth="1"
                  strokeDasharray={i === gridVals.length - 1 && dataMin < 0 ? '' : '4 3'} />
                <text x={PL - 8} y={y + 4} textAnchor="end" className="fill-muted-foreground" fontSize="10">{fmt(v)}</text>
              </g>
            );
          })}
          {labels.map((label, i) => (
            <text key={label} x={getX(i)} y={H - 4} textAnchor="middle" className="fill-muted-foreground" fontSize="10">{label}</text>
          ))}
          {lines.map((line) => {
            const points = line.values.map((v, i) => `${getX(i)},${getY(v)}`).join(' ');
            return (
              <g key={line.label}>
                <polyline points={points} fill="none" stroke={line.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {line.values.map((v, i) => (
                  <circle key={i} cx={getX(i)} cy={getY(v)} r={hoverIdx === i ? 5 : 3.5} fill="white" stroke={line.color} strokeWidth="2"
                    className="transition-all duration-200" />
                ))}
              </g>
            );
          })}
          {hoverIdx !== null && (
            <line x1={getX(hoverIdx)} y1={PT} x2={getX(hoverIdx)} y2={H - PB}
              stroke="currentColor" className="text-muted-foreground/30" strokeWidth="1" strokeDasharray="4 2" />
          )}
        </svg>

        {/* Portal tooltip */}
        {hoverIdx !== null && createPortal(
          <div
            className="fixed z-[9999] pointer-events-none"
            style={{
              top: tooltipPos.top,
              left: tooltipPos.left,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="w-max max-w-[280px] rounded-xl border border-border/60 bg-card/95 backdrop-blur-sm p-3.5 text-xs shadow-xl shadow-black/10">
              <p className="mb-2 text-[12px] font-semibold text-foreground border-b border-border/40 pb-1.5">{labels[hoverIdx]}</p>
              {lines.map((line) => (
                <div key={line.label} className="flex items-center gap-2 py-0.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: line.color }} />
                  <span className="text-muted-foreground">{line.label}</span>
                  <span className="ml-auto font-mono font-semibold tabular-nums text-foreground">{fmt(line.values[hoverIdx] ?? 0)}</span>
                </div>
              ))}
              {details?.[hoverIdx] && (
                <div className="mt-2 border-t border-border/40 pt-2">{details[hoverIdx]}</div>
              )}
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 top-full -mt-px">
              <div className="h-2.5 w-2.5 rotate-45 border-r border-b border-border/60 bg-card/95" />
            </div>
          </div>,
          document.body,
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
        {lines.map((line) => (
          <div key={line.label} className="flex items-center gap-1.5 text-xs">
            <span className="h-2 w-5 rounded-full" style={{ backgroundColor: line.color }} />
            <span className="text-muted-foreground">{line.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
