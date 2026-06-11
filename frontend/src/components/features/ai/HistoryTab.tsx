'use client';

import { useState } from 'react';
import { Plus, Search, Trash2, MessageSquare, Pin, PinOff, Pencil, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatSession } from '@/hooks/useAiChat';

interface HistoryTabProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSwitchSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onNewSession: () => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onPinSession: (sessionId: string, isPinned: boolean) => void;
}

/** 相对时间 */
function relativeTime(date: string | Date): string {
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

// ═══ 会话项（支持 inline 重命名） ═══

function SessionItem({
  session, isActive, onSwitch, onDelete, onRename, onPin,
}: {
  session: ChatSession;
  isActive: boolean;
  onSwitch: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
  onPin: (isPinned: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(session.title);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTitle(session.title);
    setEditing(true);
  };

  const handleConfirmEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (editTitle.trim()) {
      onRename(editTitle.trim());
    }
    setEditing(false);
  };

  const handleCancelEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditing(false);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => { if (!editing) onSwitch(); }}
      onKeyDown={(e) => { if (e.key === 'Enter' && !editing) onSwitch(); }}
      className={cn(
        'group flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-muted',
        isActive && 'bg-indigo-50/70',
      )}
    >
      <MessageSquare className={cn(
        'mt-0.5 h-3.5 w-3.5 shrink-0',
        isActive ? 'text-indigo-400' : 'text-muted-foreground/50',
      )} />
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmEdit();
                if (e.key === 'Escape') handleCancelEdit();
              }}
              className="w-full rounded border border-indigo-300 bg-card px-1.5 py-0.5 text-[12px] text-foreground outline-none"
            />
            <button onClick={handleConfirmEdit} className="rounded p-0.5 text-emerald-500 hover:bg-emerald-50">
              <Check className="h-3 w-3" />
            </button>
            <button onClick={handleCancelEdit} className="rounded p-0.5 text-muted-foreground hover:bg-muted">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <p className={cn(
            'truncate text-[12px] leading-tight',
            isActive ? 'font-semibold text-indigo-700' : 'text-foreground/70',
          )}>
            {session.isPinned && <Pin className="mr-1 inline h-2.5 w-2.5 text-amber-400" />}
            {session.title}
          </p>
        )}
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {session.messageCount} 条消息 · {relativeTime(session.lastMessage)}
        </p>
      </div>

      {/* 操作按钮 */}
      {!editing && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {!session.isDefault && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onPin(!session.isPinned); }}
                title={session.isPinned ? '取消置顶' : '置顶'}
                className="rounded p-0.5 text-muted-foreground/50 hover:bg-amber-50 hover:text-amber-500"
              >
                {session.isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
              </button>
              <button
                onClick={handleStartEdit}
                title="重命名"
                className="rounded p-0.5 text-muted-foreground/50 hover:bg-indigo-50 hover:text-indigo-500"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                title="删除"
                className="rounded p-0.5 text-muted-foreground/50 hover:bg-red-50 hover:text-red-400"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ═══ 主组件 ═══

export function HistoryTab({
  sessions, activeSessionId, onSwitchSession, onDeleteSession, onNewSession, onRenameSession, onPinSession,
}: HistoryTabProps) {
  const [search, setSearch] = useState('');

  // 分组：默认对话 → 置顶 → 普通
  const defaultSession = sessions.find(s => s.isDefault);
  const pinnedSessions = sessions.filter(s => s.isPinned && !s.isDefault);
  const normalSessions = sessions.filter(s => !s.isPinned && !s.isDefault);

  const filterFn = (s: ChatSession) =>
    !search.trim() || s.title.toLowerCase().includes(search.toLowerCase());

  const filteredPinned = pinnedSessions.filter(filterFn);
  const filteredNormal = normalSessions.filter(filterFn);
  const filteredDefault = defaultSession && filterFn(defaultSession) ? defaultSession : null;

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
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索会话..."
            className="w-full rounded-lg border border-border py-1.5 pl-6 pr-2 text-[11px] text-foreground/70 outline-none placeholder:text-muted-foreground/50 focus:border-indigo-300"
          />
        </div>
      )}

      {/* 会话列表 */}
      <div className="mt-2 flex-1 space-y-1 overflow-y-auto">
        {/* 默认对话 */}
        {filteredDefault && (
          <SessionItem
            session={filteredDefault}
            isActive={filteredDefault.id === activeSessionId}
            onSwitch={() => onSwitchSession(filteredDefault.id)}
            onDelete={() => {}}
            onRename={() => {}}
            onPin={() => {}}
          />
        )}

        {/* 置顶区 */}
        {filteredPinned.length > 0 && (
          <>
            <p className="mt-2 px-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/40">置顶</p>
            {filteredPinned.map((s) => (
              <SessionItem
                key={s.id}
                session={s}
                isActive={s.id === activeSessionId}
                onSwitch={() => onSwitchSession(s.id)}
                onDelete={() => onDeleteSession(s.id)}
                onRename={(title) => onRenameSession(s.id, title)}
                onPin={(isPinned) => onPinSession(s.id, isPinned)}
              />
            ))}
          </>
        )}

        {/* 普通区 */}
        {filteredNormal.length > 0 && (
          <>
            {(filteredPinned.length > 0 || filteredDefault) && (
              <p className="mt-2 px-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/40">最近</p>
            )}
            {filteredNormal.map((s) => (
              <SessionItem
                key={s.id}
                session={s}
                isActive={s.id === activeSessionId}
                onSwitch={() => onSwitchSession(s.id)}
                onDelete={() => onDeleteSession(s.id)}
                onRename={(title) => onRenameSession(s.id, title)}
                onPin={(isPinned) => onPinSession(s.id, isPinned)}
              />
            ))}
          </>
        )}

        {/* 空状态 */}
        {filteredPinned.length === 0 && filteredNormal.length === 0 && !filteredDefault && (
          <div className="py-6 text-center">
            <p className="text-[11px] text-muted-foreground">
              {search.trim() ? '没有匹配的会话' : '暂无历史会话'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
