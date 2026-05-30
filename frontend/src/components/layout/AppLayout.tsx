'use client';

import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <Header />
      <main className="ml-[268px] pt-14">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
