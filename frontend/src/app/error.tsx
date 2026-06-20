'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="rounded-full bg-red-50 p-4 dark:bg-red-950/30">
          <AlertTriangle className="h-10 w-10 text-red-400" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">页面出现异常</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          抱歉，页面加载时发生了错误。您可以尝试刷新页面，或稍后再试。
        </p>
        <Button onClick={reset} className="mt-2 gap-2">
          <RefreshCw className="h-4 w-4" />
          重新加载
        </Button>
      </div>
    </div>
  );
}
