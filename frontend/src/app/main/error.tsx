'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function MainError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('[MainError]', error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="rounded-full bg-amber-50 p-4 dark:bg-amber-950/30">
          <AlertTriangle className="h-10 w-10 text-amber-400" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">数据加载失败</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          页面数据加载时出现问题，请重试或返回首页。
        </p>
        <div className="flex gap-3 mt-2">
          <Link
            href="/main/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            <Home className="h-4 w-4" />
            返回首页
          </Link>
          <Button onClick={reset} className="gap-1.5">
            <RefreshCw className="h-4 w-4" />
            重新加载
          </Button>
        </div>
      </div>
    </div>
  );
}
