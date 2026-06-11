'use client';

import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { Sparkles, X, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAiChat, type ChatMessage, type ChatSession } from '@/hooks/useAiChat';
import { useProjectList } from '@/hooks/useProjects';
import { AiSidebar } from './AiSidebar';
import { MessageBubble } from './MessageBubble';
import { EmptyState } from './EmptyState';
import { LoadingIndicator } from './LoadingIndicator';
import { ChatInput } from './ChatInput';

const STORAGE_KEY = 'ai-last-session-id';

type TabKey = 'overview' | 'customers' | 'history' | 'schedule' | 'projects' | 'jobs';

// ═══ 消息列表（memo，避免输入时重渲染） ═══

const MessageList = memo(function MessageList({
  messages, isLoading, user, onQuickAction, onRegenerateMsg,
}: {
  messages: ChatMessage[];
  isLoading: boolean;
  user: { name: string; avatar?: string | null } | null;
  onQuickAction: (text: string) => void;
  onRegenerateMsg: (msg: ChatMessage) => void;
}) {
  if (messages.length === 0 && !isLoading) {
    return <EmptyState onPromptClick={onQuickAction} />;
  }
  return (
    <div className="space-y-5">
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          user={user}
          onRegenerate={msg.role === 'assistant' ? () => onRegenerateMsg(msg) : undefined}
        />
      ))}
      {isLoading && <LoadingIndicator />}
    </div>
  );
});

// ═══ 主组件 ═══

export function AiPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const {
    messages, isLoading,
    sendMessage, stopGeneration, regenerate,
    loadHistory, getSessions, createSession, updateSession, deleteSession, setMessages,
  } = useAiChat();

  const { data: projectData } = useProjectList({});

  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isTempSession, setIsTempSession] = useState(false); // 新建未发消息的临时状态
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | undefined>(undefined);
  const [selectedModelName, setSelectedModelName] = useState<string | undefined>(undefined);
  const [selectedProvider, setSelectedProvider] = useState<string | undefined>(undefined);
  const [modelToast, setModelToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<{ id?: string; provider?: string }>({});
  const initializedRef = useRef(false);

  // ── 刷新会话列表 ──
  const refreshSessions = useCallback(() => {
    getSessions().then(setSessions).catch(() => {});
  }, [getSessions]);

  // ── 打开面板：恢复上次会话 ──
  useEffect(() => {
    if (!open || initializedRef.current) return;
    initializedRef.current = true;

    refreshSessions();

    const savedId = localStorage.getItem(STORAGE_KEY);
    if (savedId) {
      setActiveSessionId(savedId);
      setIsTempSession(false);
      loadHistory(savedId).catch(() => {
        // 会话已被删，清空
        setActiveSessionId(null);
        localStorage.removeItem(STORAGE_KEY);
      });
    }
  }, [open, loadHistory, refreshSessions]);

  // ── 关闭面板：保存当前会话 ──
  const handleClose = useCallback(() => {
    if (activeSessionId && !isTempSession) {
      localStorage.setItem(STORAGE_KEY, activeSessionId);
    }
    onClose();
  }, [activeSessionId, isTempSession, onClose]);

  // ── 模型切换 toast ──
  const handleModelSelect = useCallback((modelId: string | undefined, provider?: string, modelName?: string) => {
    setSelectedModel(modelId);
    setSelectedProvider(provider);
    setSelectedModelName(modelName);
    modelRef.current = { id: modelId, provider };
    setModelToast(modelId ? `已切换: ${modelName || modelId}` : '已恢复默认模型');
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setModelToast(null), 2000);
  }, []);

  // ── 发送消息（核心：临时会话首次发送时创建后端会话） ──
  const handleSend = useCallback(async (text?: string) => {
    const content = text || input.trim();
    if (!content || isLoading) return;
    setInput('');

    let sessionId = activeSessionId;

    // 临时会话：首次发消息，调后端创建
    if (isTempSession || !sessionId) {
      try {
        const newSession = await createSession(content.slice(0, 30));
        sessionId = newSession.id;
        setActiveSessionId(sessionId);
        setIsTempSession(false);
        localStorage.setItem(STORAGE_KEY, sessionId);
        refreshSessions();
      } catch {
        return;
      }
    }

    const { id: currentModel, provider: currentProvider } = modelRef.current;
    await sendMessage(content, sessionId!, currentModel, currentProvider);
    refreshSessions();
  }, [input, isLoading, activeSessionId, isTempSession, sendMessage, createSession, refreshSessions]);

  const handleStop = useCallback(() => stopGeneration(), [stopGeneration]);

  const handleQuickAction = useCallback((text: string) => {
    handleSend(text);
  }, [handleSend]);

  const handleRegenerateMsg = useCallback((msg: ChatMessage) => {
    if (!activeSessionId) return;
    const { id: currentModel, provider: currentProvider } = modelRef.current;
    regenerate(msg.id, activeSessionId, currentModel, currentProvider);
  }, [regenerate, activeSessionId]);

  const handleCustomerClick = useCallback((name: string) => {
    handleSend(`帮我分析一下 ${name} 的情况`);
  }, [handleSend]);

  const handleDigestClick = useCallback(() => {
    handleSend('帮我做一个今日简报');
  }, [handleSend]);

  // ── 切换会话 ──
  const handleSwitchSession = useCallback((sid: string) => {
    setActiveSessionId(sid);
    setIsTempSession(false);
    localStorage.setItem(STORAGE_KEY, sid);
    loadHistory(sid);
  }, [loadHistory]);

  // ── 删除会话 ──
  const handleDeleteSession = useCallback(async (sid: string) => {
    await deleteSession(sid);
    if (sid === activeSessionId) {
      setActiveSessionId(null);
      setIsTempSession(false);
      setMessages([]);
      localStorage.removeItem(STORAGE_KEY);
    }
    refreshSessions();
  }, [deleteSession, activeSessionId, setMessages, refreshSessions]);

  // ── 新建会话（临时状态，不存后端） ──
  const handleNewSession = useCallback(() => {
    setActiveSessionId(null);
    setIsTempSession(true);
    setMessages([]);
    setActiveTab('overview');
  }, [setMessages]);

  // ── 重命名会话 ──
  const handleRenameSession = useCallback(async (sid: string, title: string) => {
    await updateSession(sid, { title });
    refreshSessions();
  }, [updateSession, refreshSessions]);

  // ── 置顶/取消置顶 ──
  const handlePinSession = useCallback(async (sid: string, isPinned: boolean) => {
    await updateSession(sid, { isPinned });
    refreshSessions();
  }, [updateSession, refreshSessions]);

  // 自动滚动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 清理 toast 定时器
  useEffect(() => {
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
  }, []);

  // 快捷键
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') { e.preventDefault(); handleNewSession(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, handleClose, handleNewSession]);

  const projects = (projectData as any)?.data || projectData || [];

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm transition-opacity"
          onClick={handleClose}
        />
      )}

      <div
        data-ai-panel
        className="fixed right-0 top-0 z-50 flex h-screen w-[1060px] flex-col bg-card shadow-2xl transition-transform duration-300 ease-in-out"
        style={{ transform: open ? 'translateX(0)' : 'translateX(100%)' }}
      >
        {/* 顶部栏 */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 bg-muted/40 px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100">
              <Sparkles className="h-4 w-4 text-indigo-500" />
            </div>
            <span className="text-[15px] font-bold tracking-tight text-foreground">智汇轻营</span>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-500">小语</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handleNewSession} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none" title="新对话 (⌘N)">
              <Plus className="h-4 w-4" />
            </button>
            <button onClick={handleClose} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 主体 */}
        <div className="flex min-h-0 flex-1">
          <AiSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onQuickAction={handleQuickAction}
            onCustomerClick={handleCustomerClick}
            onDigestClick={handleDigestClick}
            projects={Array.isArray(projects) ? projects : []}
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSwitchSession={handleSwitchSession}
            onDeleteSession={handleDeleteSession}
            onNewSession={handleNewSession}
            onRenameSession={handleRenameSession}
            onPinSession={handlePinSession}
            selectedModel={selectedModel}
            selectedModelName={selectedModelName}
            onModelSelect={handleModelSelect}
            open={open}
          />

          {/* 右侧对话区 */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <MessageList
                messages={messages}
                isLoading={isLoading}
                user={user ? { name: user.name, avatar: user.avatar } : null}
                onQuickAction={handleQuickAction}
                onRegenerateMsg={handleRegenerateMsg}
              />
              <div ref={messagesEndRef} />
            </div>

            <ChatInput
              value={input}
              onChange={setInput}
              onSend={() => handleSend()}
              onStop={handleStop}
              isLoading={isLoading}
              toastMessage={modelToast}
            />
          </div>
        </div>
      </div>
    </>
  );
}
