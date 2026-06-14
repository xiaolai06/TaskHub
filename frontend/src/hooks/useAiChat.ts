'use client';

import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** AI 写操作工具执行后需失效的缓存 key */
const WRITE_TOOL_CACHE_MAP: Record<string, string[]> = {
  create_project: ['projects', 'dashboard', 'header'],
  update_project: ['projects', 'dashboard', 'header'],
  delete_project: ['projects', 'dashboard', 'header'],
  archive_project: ['projects', 'dashboard', 'header'],
  create_task: ['tasks', 'projects', 'dashboard', 'header'],
  update_task_status: ['tasks', 'projects', 'dashboard', 'header'],
  delete_task: ['tasks', 'projects', 'dashboard', 'header'],
  undo_last_tool: ['projects', 'tasks', 'customers', 'costs', 'dashboard', 'header'],
  log_time: ['projects', 'dashboard'],
  log_communication: ['customers', 'dashboard'],
  create_customer: ['customers', 'dashboard', 'header'],
  update_customer: ['customers', 'dashboard', 'header'],
  delete_customer: ['customers', 'dashboard', 'header'],
  create_transaction: ['transactions', 'dashboard', 'header'],
  update_transaction: ['transactions', 'dashboard', 'header'],
  delete_transaction: ['transactions', 'dashboard', 'header'],
  create_payment: ['payments', 'transactions', 'dashboard', 'header'],
  create_cost: ['costs', 'projects', 'dashboard', 'header'],
  delete_cost: ['costs', 'projects', 'dashboard', 'header'],
  create_goal: ['goals', 'dashboard', 'header'],
  update_goal: ['goals', 'dashboard', 'header'],
  update_goal_progress: ['goals', 'dashboard', 'header'],
  add_todo: ['todos', 'dashboard'],
  toggle_todo: ['todos', 'dashboard'],
  create_subscription: ['subscriptions', 'dashboard'],
  pause_subscription: ['subscriptions', 'dashboard'],
  resume_subscription: ['subscriptions', 'dashboard'],
  mark_as_read: ['notifications', 'header'],
};

export interface ToolCallEvent {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: 'calling' | 'done' | 'error';
  toolCallId?: string;
  durationMs?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCallEvent[];
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  title: string;
  isPinned: boolean;
  isDefault: boolean;
  messageCount: number;
  lastMessage: string;
  preview: string;
  createdAt: string;
  updatedAt: string;
}

function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** SSE 流式消费共享逻辑 */
async function consumeSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  aiId: string,
  opts: {
    onText: (content: string) => void;
    onToolCall: (name: string, args: Record<string, unknown>, id: string, tools: ToolCallEvent[]) => void;
    onToolResult: (name: string, result: unknown, tools: ToolCallEvent[]) => void;
    onDone: (tools: ToolCallEvent[]) => void;
  },
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';
  const tools: ToolCallEvent[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') { opts.onDone(tools); return; }
      try {
        const event = JSON.parse(data);
        switch (event.type) {
          case 'text':
            opts.onText(event.content);
            break;
          case 'tool_call':
            tools.push({ name: event.name, args: event.args, status: 'calling', toolCallId: event.id });
            opts.onToolCall(event.name, event.args, event.id, [...tools]);
            break;
          case 'tool_result':
            for (const t of tools) {
              if (t.name === event.name) { t.result = event.result; t.status = 'done'; t.durationMs = event.durationMs; }
            }
            opts.onToolResult(event.name, event.result, [...tools]);
            break;
          case 'done':
            opts.onDone([...tools]);
            return;
        }
      } catch (e) {
        // SSE JSON 解析失败 — 记录但不中断流
        console.warn('[SSE] JSON 解析失败:', data.slice(0, 100), e);
      }
    }
  }
  opts.onDone([...tools]);
}

export function useAiChat() {
  const qc = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentToolCalls, setCurrentToolCalls] = useState<ToolCallEvent[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  /** 启动 SSE 请求并消费流 */
  const startStream = useCallback(async (
    message: string,
    conversationSessionId: string,
    aiId: string,
    model?: string,
    provider?: string,
    showStopMsg = true,
  ): Promise<void> => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const controller = new AbortController();
    abortRef.current = controller;

    const res = await fetch(`${API_BASE}/llm/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ message, conversationSessionId, model, provider }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const reader = res.body!.getReader();

    await consumeSSEStream(reader, aiId, {
      onText: (content) => {
        setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: m.content + content } : m));
      },
      onToolCall: (_name, _args, _id, allTools) => {
        setCurrentToolCalls(allTools);
        setMessages(prev => prev.map(m => m.id === aiId ? { ...m, toolCalls: allTools } : m));
      },
      onToolResult: (_name, _result, allTools) => {
        setCurrentToolCalls(allTools);
        setMessages(prev => prev.map(m => m.id === aiId ? { ...m, toolCalls: allTools } : m));
      },
      onDone: (allTools) => {
        for (const t of allTools) {
          const keys = WRITE_TOOL_CACHE_MAP[t.name];
          if (keys) keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
        }
        setIsLoading(false);
        setCurrentToolCalls([]);
      },
    });
  }, [qc]);

  /** 带文件的 SSE 请求 */
  const startStreamWithFiles = useCallback(async (
    message: string,
    conversationSessionId: string,
    files: File[],
    aiId: string,
    model?: string,
    provider?: string,
  ): Promise<void> => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const controller = new AbortController();
    abortRef.current = controller;

    const formData = new FormData();
    formData.append('message', message);
    formData.append('conversationSessionId', conversationSessionId);
    if (model) formData.append('model', model);
    if (provider) formData.append('provider', provider);
    for (const file of files) {
      formData.append('files', file);
    }

    const res = await fetch(`${API_BASE}/llm/chat/upload`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const reader = res.body!.getReader();

    await consumeSSEStream(reader, aiId, {
      onText: (content) => {
        setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: m.content + content } : m));
      },
      onToolCall: (_name, _args, _id, allTools) => {
        setCurrentToolCalls(allTools);
        setMessages(prev => prev.map(m => m.id === aiId ? { ...m, toolCalls: allTools } : m));
      },
      onToolResult: (_name, _result, allTools) => {
        setCurrentToolCalls(allTools);
        setMessages(prev => prev.map(m => m.id === aiId ? { ...m, toolCalls: allTools } : m));
      },
      onDone: (allTools) => {
        for (const t of allTools) {
          const keys = WRITE_TOOL_CACHE_MAP[t.name];
          if (keys) keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
        }
        setIsLoading(false);
        setCurrentToolCalls([]);
      },
    });
  }, [qc]);

  const sendMessage = useCallback(async (
    message: string,
    conversationSessionId: string,
    model?: string,
    provider?: string,
    files?: File[],
  ): Promise<void> => {
    abortRef.current?.abort();
    setIsLoading(true);
    setCurrentToolCalls([]);

    const userMsg: ChatMessage = {
      id: uid(),
      role: 'user',
      content: message + (files && files.length > 0 ? `\n📎 ${files.map(f => f.name).join(', ')}` : ''),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    const aiId = uid();
    const aiMsg: ChatMessage = { id: aiId, role: 'assistant', content: '', toolCalls: [], timestamp: new Date() };
    setMessages(prev => [...prev, aiMsg]);

    try {
      if (files && files.length > 0) {
        // 有文件：用 FormData
        await startStreamWithFiles(message, conversationSessionId, files, aiId, model, provider);
      } else {
        await startStream(message, conversationSessionId, aiId, model, provider, true);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: m.content + '\n\n_已停止生成_' } : m));
      } else {
        setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: `错误: ${err instanceof Error ? err.message : '通信失败'}` } : m));
      }
      setIsLoading(false);
      setCurrentToolCalls([]);
    }
  }, [startStream]);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const loadHistory = useCallback(async (sessionId: string) => {
    const data = await api.get<Array<{ id: string; role: string; content: string; createdAt: string }>>(`/llm/conversations/${sessionId}/messages`);
    setMessages(data.map(m => ({
      id: m.id, role: m.role as 'user' | 'assistant', content: m.content, timestamp: new Date(m.createdAt),
    })));
  }, []);

  const getSessions = useCallback(async (): Promise<ChatSession[]> => {
    return api.get<ChatSession[]>('/llm/conversations');
  }, []);

  const createSession = useCallback(async (title?: string): Promise<ChatSession> => {
    return api.post<ChatSession>('/llm/conversations', { title });
  }, []);

  const updateSession = useCallback(async (id: string, data: { title?: string; isPinned?: boolean }): Promise<ChatSession> => {
    return api.patch<ChatSession>(`/llm/conversations/${id}`, data);
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    await api.delete(`/llm/conversations/${id}`);
  }, []);

  const regenerate = useCallback(async (
    aiMessageId: string,
    conversationSessionId: string,
    model?: string,
    provider?: string,
  ): Promise<void> => {
    abortRef.current?.abort();

    let lastUserMsg = '';
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === aiMessageId);
      if (idx > 0 && prev[idx - 1].role === 'user') {
        lastUserMsg = prev[idx - 1].content;
      }
      return prev.filter(m => m.id !== aiMessageId);
    });

    if (!lastUserMsg) return;

    setIsLoading(true);
    setCurrentToolCalls([]);

    const aiId = uid();
    const aiMsg: ChatMessage = { id: aiId, role: 'assistant', content: '', toolCalls: [], timestamp: new Date() };
    setMessages(prev => [...prev, aiMsg]);

    try {
      await startStream(lastUserMsg, conversationSessionId, aiId, model, provider, false);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // 不追加"已停止生成"
      } else {
        setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: `错误: ${err instanceof Error ? err.message : '通信失败'}` } : m));
      }
      setIsLoading(false);
      setCurrentToolCalls([]);
    }
  }, [startStream]);

  return {
    messages, isLoading, currentToolCalls,
    sendMessage, stopGeneration, regenerate,
    loadHistory, getSessions, createSession, updateSession, deleteSession, setMessages,
  };
}
