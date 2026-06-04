'use client';

import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { Zap, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useAiChat, type ChatMessage } from '@/hooks/useAiChat';
import { useProjectList } from '@/hooks/useProjects';
import { AiSidebar } from './AiSidebar';
import { MessageBubble } from './MessageBubble';
import { EmptyState } from './EmptyState';
import { LoadingIndicator } from './LoadingIndicator';
import { ChatInput } from './ChatInput';

type TabKey = 'overview' | 'customers' | 'history' | 'schedule';

// ═══ 消息列表（memo，避免输入时重渲染） ═══

const MessageList = memo(function MessageList({
  messages,
  isLoading,
  user,
  onQuickAction,
  onRegenerateMsg,
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
    sendMessage, stopGeneration,
    loadHistory, getSessions, deleteSession, setMessages,
  } = useAiChat();

  const { data: projectData } = useProjectList({});

  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [activeSessionId, setActiveSessionId] = useState('default');
  const [sessions, setSessions] = useState<Array<{ sessionId: string; messageCount: number; lastMessage: Date; title?: string }>>([]);
  const [selectedModel, setSelectedModel] = useState<string | undefined>(undefined);
  const [selectedModelName, setSelectedModelName] = useState<string | undefined>(undefined);
  const [selectedProvider, setSelectedProvider] = useState<string | undefined>(undefined);
  const [modelToast, setModelToast] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // 用 ref 保存最新的 model/provider，避免 useCallback 闭包捕获旧值
  const modelRef = useRef<{ id?: string; provider?: string }>({});

  // 模型切换 toast
  const handleModelSelect = useCallback((modelId: string | undefined, provider?: string, modelName?: string) => {
    setSelectedModel(modelId);
    setSelectedProvider(provider);
    setSelectedModelName(modelName);
    modelRef.current = { id: modelId, provider };
    setModelToast(modelId ? `已切换: ${modelName || modelId}` : '已恢复默认模型');
    setTimeout(() => setModelToast(null), 2000);
  }, []);

  // 发送消息
  const handleSend = useCallback(async (text?: string) => {
    const content = text || input.trim();
    if (!content || isLoading) return;
    setInput('');
    const { id: currentModel, provider: currentProvider } = modelRef.current;
    await sendMessage(content, activeSessionId, currentModel, currentProvider);
    getSessions().then(setSessions).catch(() => {});
  }, [input, isLoading, sendMessage, activeSessionId, getSessions]);

  // 停止
  const handleStop = useCallback(() => stopGeneration(), [stopGeneration]);

  // 快捷操作
  const handleQuickAction = useCallback((text: string) => {
    handleSend(text);
  }, [handleSend]);

  // 重新生成
  const handleRegenerateMsg = useCallback((msg: ChatMessage) => {
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === msg.id);
      if (idx <= 0) return prev;
      const prevUser = prev[idx - 1];
      if (prevUser.role !== 'user') return prev;
      const newMsgs = prev.slice(0, idx);
      sendMessage(prevUser.content, activeSessionId, modelRef.current.id, modelRef.current.provider);
      return newMsgs;
    });
  }, [setMessages, sendMessage, activeSessionId]);

  // 客户点击
  const handleCustomerClick = useCallback((name: string) => {
    handleSend(`帮我分析一下 ${name} 的情况`);
  }, [handleSend]);

  // 今日数据
  const handleDigestClick = useCallback(() => {
    handleSend('帮我做一个今日简报');
  }, [handleSend]);

  // 会话切换
  const handleSwitchSession = useCallback((sid: string) => {
    setActiveSessionId(sid);
    loadHistory(sid);
  }, [loadHistory]);

  // 删除会话
  const handleDeleteSession = useCallback(async (sid: string) => {
    await deleteSession(sid);
    if (sid === activeSessionId) {
      const newId = Date.now().toString();
      setActiveSessionId(newId);
      setMessages([]);
    }
    getSessions().then(setSessions).catch(() => {});
  }, [deleteSession, activeSessionId, setMessages, getSessions]);

  // 新建会话
  const handleNewSession = useCallback(() => {
    const newId = Date.now().toString();
    setActiveSessionId(newId);
    setMessages([]);
    setActiveTab('overview');
  }, [setMessages]);

  // 自动滚动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 加载会话列表
  useEffect(() => {
    if (open) getSessions().then(setSessions).catch(() => {});
  }, [open, getSessions]);

  // 快捷键
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') { e.preventDefault(); handleNewSession(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, handleNewSession]);

  const projects = (projectData as any)?.data || projectData || [];

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      <div
        className="fixed right-0 top-0 z-50 flex h-screen w-[860px] flex-col bg-card shadow-2xl transition-transform duration-300 ease-in-out"
        style={{ transform: open ? 'translateX(0)' : 'translateX(100%)' }}
      >
        {/* 顶部栏 */}
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-muted/50 px-3">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10">
              <Zap className="h-3 w-3 text-primary" />
            </div>
            <span className="text-[13px] font-semibold text-foreground">AI 助手</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handleNewSession} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none" title="新对话 (⌘N)">
              <Plus className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none">
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
