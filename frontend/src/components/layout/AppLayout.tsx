'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { AiPanel } from '@/components/features/ai/AiPanel';
import { useAuth } from '@/hooks/useAuth';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [aiOpen, setAiOpen] = useState(false);
  const fetchUser = useAuth((s) => s.fetchUser);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar onOpenAi={() => setAiOpen(true)} />
      <div className="flex min-w-0 flex-1 flex-col ml-[272px]">
        <Header onOpenAi={() => setAiOpen(true)} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="p-4">{children}</div>
        </main>
      </div>
      <AiPanel open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
}
