'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useIsMobile';

interface LeftSidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  width?: number;
  children: React.ReactNode;
}

/**
 * 从屏幕左侧滑入的面板，避免与右侧 Sheet 重叠。
 * z-index 60（在 z-40 遮罩之上，z-80 记账弹窗之下）。
 * 手机端自动全屏。
 */
export function LeftSidePanel({
  open,
  onClose,
  title,
  subtitle,
  width = 420,
  children,
}: LeftSidePanelProps) {
  const isMobile = useIsMobile(640);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <>
      {/* 遮罩 */}
      <div
        className="fixed inset-0 z-[60] bg-black/10 transition-opacity"
        onClick={onClose}
      />

      {/* 面板 */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-[61] flex flex-col border-r border-border bg-card shadow-2xl',
          'transition-transform duration-300 ease-in-out',
        )}
        style={{ width: isMobile ? '100%' : width, transform: open ? 'translateX(0)' : 'translateX(-100%)' }}
      >
        {/* 头部 */}
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-5 py-3.5">
          <div>
            <h3 className="text-sm font-bold text-foreground">{title}</h3>
            {subtitle && (
              <p className="mt-0.5 text-2xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground/60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </>,
    document.body,
  );
}
