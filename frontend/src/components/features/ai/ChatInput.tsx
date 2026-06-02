'use client';

import { useRef } from 'react';
import { Send, Square, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isLoading: boolean;
  /** 模型切换提示，显示后自动消失 */
  toastMessage?: string | null;
}

/** 根据时间返回 3 个快捷建议 */
function getTimeChips(): { icon: string; text: string }[] {
  const hour = new Date().getHours();

  if (hour >= 6 && hour < 10) {
    return [
      { icon: '🌅', text: '今日简报' },
      { icon: '📋', text: '查看任务' },
      { icon: '⚠️', text: '风险扫描' },
    ];
  }
  if (hour >= 10 && hour < 17) {
    return [
      { icon: '📝', text: '创建任务' },
      { icon: '⏱', text: '记录工时' },
      { icon: '📞', text: '客户跟进' },
    ];
  }
  if (hour >= 17 && hour < 22) {
    return [
      { icon: '🌙', text: '今日总结' },
      { icon: '📅', text: '明日计划' },
      { icon: '💰', text: '财务概览' },
    ];
  }
  return [
    { icon: '🌅', text: '今日简报' },
    { icon: '📊', text: '项目进度' },
    { icon: '👤', text: '客户分析' },
  ];
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  isLoading,
  toastMessage,
}: ChatInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const chips = getTimeChips();

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && value.trim()) onSend();
    }
  }

  function handleChipClick(text: string) {
    onChange(text);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <div className="shrink-0 border-t bg-background px-3 pb-3 pt-2.5">
      {/* 模型切换 toast — 2s 自动消失 */}
      {toastMessage && (
        <div className="mb-2 flex items-center gap-1.5 rounded-md bg-emerald-50/70 px-2.5 py-1.5 text-[10px] text-emerald-700 animate-in fade-in slide-in-from-left-2">
          <Check className="h-3 w-3" />
          {toastMessage}
        </div>
      )}

      {/* 快捷建议 — 在输入框上方 */}
      <div className="mb-2 flex items-center gap-1.5">
        {chips.map((chip) => (
          <button
            key={chip.text}
            onClick={() => handleChipClick(chip.text)}
            disabled={isLoading}
            className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40"
          >
            {chip.icon} {chip.text}
          </button>
        ))}
      </div>

      {/* 输入行 */}
      <div className="flex items-center gap-2">
        <label htmlFor="ai-chat-input" className="sr-only">输入你的问题</label>
        <input
          ref={inputRef}
          id="ai-chat-input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isLoading ? 'AI 正在思考...' : '输入你的问题...'}
          disabled={isLoading}
          className="h-[40px] flex-1 rounded-xl border border-border bg-background px-4 text-[13px] text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-300 focus:bg-background focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"
        />

        {isLoading ? (
          <button
            onClick={onStop}
            className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-xl bg-red-500 text-white transition-all hover:bg-red-600 active:scale-95 focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:outline-none"
            aria-label="停止生成"
          >
            <Square className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <button
            onClick={onSend}
            disabled={!value.trim()}
            aria-label="发送消息"
            className={cn(
              'flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-xl transition-all duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none',
              value.trim()
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                : 'bg-muted text-muted-foreground',
            )}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
