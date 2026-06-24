'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Loader2, Smartphone, LogOut } from 'lucide-react';

interface Session {
  id: string;
  device: string;
  ip: string;
  createdAt: string;
  expiresAt: string;
}

export function SessionTab() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Session[]>('/settings/sessions')
      .then((res) => setSessions(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleKick(id: string) {
    try {
      await api.delete(`/settings/sessions/${id}`);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch {}
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground/80">登录设备</h3>
        {sessions.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">暂无登录设备</p>
        ) : (
          <div className="divide-y rounded-lg border border-border">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <Smartphone className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground/80">{s.device}</p>
                  <p className="text-2xs-plus text-muted-foreground">IP: {s.ip} · {new Date(s.createdAt).toLocaleDateString('zh-CN')}</p>
                </div>
                <button onClick={() => handleKick(s.id)}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30">
                  <LogOut className="h-3.5 w-3.5" />踢出
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
        <p className="text-sm text-muted-foreground">两步验证 / API Token 管理开发中...</p>
      </div>
    </div>
  );
}
