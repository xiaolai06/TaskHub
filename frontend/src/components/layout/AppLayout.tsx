'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/useIsMobile';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

const AiPanel = dynamic(() => import('@/components/features/ai/AiPanel').then(m => m.AiPanel), { ssr: false });

export function AppLayout({ children }: { children: ReactNode }) {
  const [aiOpen, setAiOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
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

  // 切换桌面侧边栏
  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  }

  // 切换手机侧边栏
  function toggleMobileSidebar() {
    setMobileSidebarOpen((prev) => !prev);
  }

  // 手机端点击导航后自动关闭侧边栏
  function handleMobileNavClick() {
    if (isMobile) {
      setMobileSidebarOpen(false);
    }
  }

  // 手机端切换时锁定 body 滚动
  useEffect(() => {
    if (isMobile && mobileSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobile, mobileSidebarOpen]);

  return (
    <div className="relative flex h-screen overflow-hidden bg-muted">
      {/* 背景流动光晕 */}
      <div className="bg-orbs bg-orbs--app">
        <div className="bg-orb bg-orb--1" />
        <div className="bg-orb bg-orb--2" />
        <div className="bg-orb bg-orb--3" />
      </div>

      {/* 手机端遮罩 */}
      {isMobile && mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-[45] bg-black/40 backdrop-blur-sm transition-opacity"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <Sidebar
        onOpenAi={() => setAiOpen(true)}
        collapsed={isMobile ? false : sidebarCollapsed}
        onToggleCollapse={isMobile ? () => setMobileSidebarOpen(false) : toggleSidebar}
        isMobile={isMobile}
        mobileOpen={mobileSidebarOpen}
        onNavClick={handleMobileNavClick}
      />

      <div
        className="relative flex min-w-0 flex-1 flex-col transition-[margin] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ marginLeft: isMobile ? 0 : sidebarCollapsed ? '66px' : '210px', zIndex: 1 }}
      >
        <Header
          onOpenAi={() => setAiOpen(true)}
          isMobile={isMobile}
          onToggleMobileSidebar={toggleMobileSidebar}
        />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="p-3 md:p-4 lg:p-6">{children}</div>
        </main>
      </div>

      <AiPanel open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
}
