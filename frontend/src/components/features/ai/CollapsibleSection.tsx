'use client';

import { useState, type ReactNode } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  title: string;
  icon?: ReactNode;
  badge?: string | number;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  icon,
  badge,
  defaultOpen = false,
  className,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn('space-y-1', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground/70"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        {icon}
        <span className="flex-1 text-left">{title}</span>
        {badge !== undefined && (
          <span className="text-2xs font-normal text-muted-foreground/50">
            {badge}
          </span>
        )}
      </button>
      {open && <div className="space-y-0.5">{children}</div>}
    </div>
  );
}
