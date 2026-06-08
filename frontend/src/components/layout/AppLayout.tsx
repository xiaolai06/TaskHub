'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { AiPanel } from '@/components/features/ai/AiPanel';
import { useAuth } from '@/hooks/useAuth';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function AppLayout({ children }: { children: ReactNode }) {
  const [aiOpen, setAiOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const fetchUser = useAuth((state) => state.fetchUser);

  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === 'true') {
      setSidebarCollapsed(true);
    }
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  }

  return (
    <div className="relative flex h-screen overflow-hidden bg-muted">
      <Sidebar
        onOpenAi={() => setAiOpen(true)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />
      <div
        className="relative flex min-w-0 flex-1 flex-col transition-[margin] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ marginLeft: sidebarCollapsed ? '66px' : '210px', zIndex: 1 }}
      >
        <Header onOpenAi={() => setAiOpen(true)} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="p-4">{children}</div>
        </main>
      </div>
      <AiPanel open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
}
