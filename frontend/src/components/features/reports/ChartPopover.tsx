'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

interface ChartPopoverProps {
  children: ReactNode;
  content: ReactNode;
  maxHeight?: number;
}

/**
 * 通用图表悬浮弹窗 — Portal 渲染到 body，不受 overflow-hidden 裁剪。
 * 带 120ms 关闭延迟防止鼠标过渡时闪烁。
 */
export function ChartPopover({ children, content, maxHeight = 340 }: ChartPopoverProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const scheduleOpen = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }, []);

  const scheduleClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }, []);

  const updatePos = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ top: rect.top - 8, left: rect.left + rect.width / 2 });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const handler = () => updatePos();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || popoverRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Escape 关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  return (
    <>
      <div
        ref={triggerRef}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
        onFocus={scheduleOpen}
        onBlur={scheduleClose}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') scheduleOpen(); }}
      >
        {children}
      </div>
      {open && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[9999]"
          style={{ top: pos.top, left: pos.left, transform: 'translate(-50%, -100%)' }}
          onMouseEnter={scheduleOpen}
          onMouseLeave={scheduleClose}
          role="tooltip"
        >
          <div
            className="w-max max-w-[320px] rounded-xl border border-border/60 bg-card/95 backdrop-blur-sm p-3.5 text-xs shadow-xl shadow-black/10"
            style={{ maxHeight, overflowY: 'auto' }}
          >
            {content}
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 top-full -mt-px">
            <div className="h-2.5 w-2.5 rotate-45 border-r border-b border-border/60 bg-card/95" />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
