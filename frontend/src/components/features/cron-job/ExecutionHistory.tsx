'use client';

import { useState } from 'react';
import { ChevronDown, CheckCircle, XCircle, MinusCircle, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useJobHistory, type JobExecutionEntry } from '@/hooks/useCronJobs';
import { timeAgo, formatDuration, EXEC_STATUS_CONFIG } from './cron-utils';

const STATUS_ICONS: Record<string, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  skipped: MinusCircle,
};

function HistoryRow({ entry }: { entry: JobExecutionEntry }) {
  const cfg = EXEC_STATUS_CONFIG[entry.status as keyof typeof EXEC_STATUS_CONFIG] || EXEC_STATUS_CONFIG.skipped;
  const Icon = STATUS_ICONS[entry.status] || MinusCircle;

  return (
    <div className="flex items-start gap-2 px-2 py-1.5 text-xs hover:bg-muted/30 rounded">
      <Icon className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', cfg.cls)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn('font-medium', cfg.cls)}>{cfg.label}</span>
          {entry.durationMs != null && (
            <span className="flex items-center gap-0.5 text-muted-foreground/60">
              <Clock className="h-2.5 w-2.5" />{formatDuration(entry.durationMs)}
            </span>
          )}
          <span className="ml-auto shrink-0 text-muted-foreground/50">{timeAgo(entry.executedAt)}</span>
        </div>
        {entry.result && <p className="mt-0.5 text-muted-foreground/70 truncate">{entry.result}</p>}
        {entry.error && <p className="mt-0.5 text-red-400/80 truncate">{entry.error}</p>}
      </div>
    </div>
  );
}

interface ExecutionHistoryProps {
  jobId: string;
}

export function ExecutionHistory({ jobId }: ExecutionHistoryProps) {
  const [open, setOpen] = useState(false);
  const { data: history, isLoading } = useJobHistory(jobId);

  return (
    <div className="border-t border-border/40 pt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 text-2xs-plus font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
        执行记录
        {history && history.length > 0 && (
          <span className="ml-1 rounded-full bg-muted px-1.5 text-2xs text-muted-foreground/60">{history.length}</span>
        )}
      </button>

      {open && (
        <div className="mt-1.5 max-h-48 overflow-y-auto rounded-lg border border-border/40 bg-muted/20">
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isLoading && (!history || history.length === 0) && (
            <p className="py-4 text-center text-2xs text-muted-foreground/50">暂无执行记录</p>
          )}
          {!isLoading && history && history.length > 0 && (
            <div className="divide-y divide-border/30 p-1">
              {history.map(entry => <HistoryRow key={entry.id} entry={entry} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
