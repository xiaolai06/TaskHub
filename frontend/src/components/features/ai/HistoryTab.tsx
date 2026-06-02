'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, Trash2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SessionItem {
  sessionId: string;
  messageCount: number;
  lastMessage: Date;
  title?: string;
}

interface HistoryTabProps {
  sessions: SessionItem[];
  activeSessionId: string;
  onSwitchSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onNewSession: () => void;
}

/** 计算相对时间显示 */
function relativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days === 1) return '昨天';
  if (days === 2) return '前天';
  return new Date(date).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

/** 从会话中推断标题 */
function inferTitle(session: SessionItem): string {
  if (session.title) return session.title;
  if (session.sessionId === 'default') return '默认会话';
  // 用 sessionId 前缀做显示
  return `会话 ${session.sessionId.slice(0, 8)}`;
}

export function HistoryTab({
  sessions,
  activeSessionId,
  onSwitchSession,
  onDeleteSession,
  onNewSession,
}: HistoryTabProps) {
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? sessions.filter(s => inferTitle(s).toLowerCase().includes(search.toLowerCase()))
    : sessions;

  return (
    <div className="flex h-full flex-col">
      {/* 新建按钮 */}
      <button
        onClick={onNewSession}
        className="flex w-full items-center gap-2 rounded-lg border-2 border-dashed border-indigo-200 px-3 py-2.5 text-[13px] font-medium text-indigo-500 transition-all hover:border-indigo-300 hover:bg-indigo-50"
      >
        <Plus className="h-4 w-4" />
        新对话
      </button>

      {/* 搜索 */}
      {sessions.length > 5 && (
        <div className="relative mt-2">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索会话..."
            className="w-full rounded-lg border border-slate-200 py-1.5 pl-6 pr-2 text-[11px] text-slate-600 outline-none placeholder:text-slate-300 focus:border-indigo-300"
          />
        </div>
      )}

      {/* 会话列表 */}
      <div className="mt-2 flex-1 space-y-0.5 overflow-y-auto">
        {filtered.map((s) => (
          <div
            key={s.sessionId}
            role="button"
            tabIndex={0}
            onClick={() => onSwitchSession(s.sessionId)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSwitchSession(s.sessionId); }}
            className={cn(
              'group flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted',
              s.sessionId === activeSessionId && 'bg-indigo-50/70',
            )}
          >
            <MessageSquare className={cn(
              'mt-0.5 h-3.5 w-3.5 shrink-0',
              s.sessionId === activeSessionId ? 'text-indigo-400' : 'text-slate-300',
            )} />
            <div className="min-w-0 flex-1">
              <p className={cn(
                'truncate text-[12px] leading-tight',
                s.sessionId === activeSessionId ? 'font-semibold text-indigo-700' : 'text-slate-600',
              )}>
                {inferTitle(s)}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">
                {s.messageCount} 条消息 · {relativeTime(s.lastMessage)}
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteSession(s.sessionId); }}
              className="shrink-0 rounded p-0.5 text-slate-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-400 group-hover:opacity-100"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="py-6 text-center">
            <p className="text-[11px] text-slate-500">
              {search.trim() ? '没有匹配的会话' : '暂无历史会话'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
