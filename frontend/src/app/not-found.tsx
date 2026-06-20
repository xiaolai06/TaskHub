'use client';

import Link from 'next/link';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="text-7xl font-bold text-muted-foreground/30">404</div>
        <h1 className="text-xl font-semibold text-foreground">页面不存在</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          您访问的页面不存在或已被移除，请检查地址是否正确。
        </p>
        <div className="flex gap-3 mt-2">
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            返回上页
          </button>
          <Link
            href="/main/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
          >
            <Home className="h-4 w-4" />
            回到首页
          </Link>
        </div>
      </div>
    </div>
  );
}
