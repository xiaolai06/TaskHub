'use client';

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** AI 写操作工具执行后需失效的缓存 key */
const WRITE_TOOL_CACHE_MAP: Record<string, string[]> = {
  create_project: ['projects'],
  update_project: ['projects'],
  create_task: ['tasks', 'projects'],
  update_task_status: ['tasks', 'projects'],
  delete_task: ['tasks', 'projects'],
  log_time: ['projects'],
  log_communication: ['customers'],
};

interface ToolCallEvent {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: 'calling' | 'done' | 'error';
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCallEvent[];
  timestamp: Date;
}

interface ChatSession {
  sessionId: string;
  messageCount: number;
  lastMessage: Date;
}

export function useAiChat() {
  const qc = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentToolCalls, setCurrentToolCalls] = useState<ToolCallEvent[]>([]);

  const sendMessage = useCallback(async (message: string, sessionId: string = 'default'): Promise<void> => {
    setIsLoading(true);
    setCurrentToolCalls([]);

    const userMsg: ChatMessage = {
      id: Date.now().toString(), role: 'user', content: message, timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    const aiId = (Date.now() + 1).toString();
    const aiMsg: ChatMessage = { id: aiId, role: 'assistant', content: '', toolCalls: [], timestamp: new Date() };
    setMessages(prev => [...prev, aiMsg]);

    try {
      const res = await fetch('http://localhost:3001/api/llm/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message, sessionId }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body!.getReader();
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
          if (data === '[DONE]') {
            setIsLoading(false);
            setCurrentToolCalls([]);
            return;
          }
          try {
            const event = JSON.parse(data);
            switch (event.type) {
              case 'text':
                setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: m.content + event.content } : m));
                break;
              case 'tool_call':
                tools.push({ name: event.name, args: event.args, status: 'calling' });
                setCurrentToolCalls([...tools]);
                setMessages(prev => prev.map(m => m.id === aiId ? { ...m, toolCalls: [...tools] } : m));
                break;
              case 'tool_result':
                for (const t of tools) {
                  if (t.name === event.name) { t.result = event.result; t.status = 'done'; }
                }
                setCurrentToolCalls([...tools]);
                setMessages(prev => prev.map(m => m.id === aiId ? { ...m, toolCalls: [...tools] } : m));
                break;
              case 'done':
                // 写操作工具完成后失效缓存，列表实时刷新
                for (const t of tools) {
                  const keys = WRITE_TOOL_CACHE_MAP[t.name];
                  if (keys) keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
                }
                setIsLoading(false);
                setCurrentToolCalls([]);
                return;
            }
          } catch { /* parse failure — skip */ }
        }
      }
      setIsLoading(false);
      setCurrentToolCalls([]);
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: `错误: ${err instanceof Error ? err.message : '通信失败'}` } : m));
      setIsLoading(false);
      setCurrentToolCalls([]);
    }
  }, []);

  const loadHistory = useCallback(async (sessionId: string) => {
    const data = await api.get<Array<{ id: string; role: string; content: string; createdAt: string }>>(`/llm/conversations/${sessionId}`);
    setMessages(data.map(m => ({
      id: m.id, role: m.role as 'user' | 'assistant', content: m.content, timestamp: new Date(m.createdAt),
    })));
  }, []);

  const getSessions = useCallback(async (): Promise<ChatSession[]> => {
    return api.get<ChatSession[]>('/llm/conversations');
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    await api.delete(`/llm/conversations/${sessionId}`);
  }, []);

  return { messages, isLoading, currentToolCalls, sendMessage, loadHistory, getSessions, deleteSession, setMessages };
}
