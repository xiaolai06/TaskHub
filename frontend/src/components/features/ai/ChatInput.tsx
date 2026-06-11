'use client';

import { useRef } from 'react';
import { Send, Square, Check, Mic, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isLoading: boolean;
  toastMessage?: string | null;
}

function getTimeChips(): { icon: string; text: string }[] {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 10) return [
    { icon: '🌅', text: '今日简报' },
    { icon: '📋', text: '查看任务' },
    { icon: '⚠️', text: '风险扫描' },
  ];
  if (hour >= 10 && hour < 17) return [
    { icon: '📝', text: '创建任务' },
    { icon: '⏱', text: '记录工时' },
    { icon: '📞', text: '客户跟进' },
  ];
  if (hour >= 17 && hour < 22) return [
    { icon: '🌙', text: '今日总结' },
    { icon: '📅', text: '明日计划' },
    { icon: '💰', text: '财务概览' },
  ];
  return [
    { icon: '✨', text: '今日简报' },
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chips = getTimeChips();

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && value.trim()) onSend();
    }
  }

  function handleChipClick(text: string) {
    onChange(text);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  return (
    <div className="shrink-0 px-4 pb-3.5 pt-1.5">
      {/* 模型切换 toast */}
      {toastMessage && (
        <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-emerald-50/70 px-2.5 py-1.5 text-[10px] text-emerald-700 animate-in fade-in slide-in-from-left-2">
          <Check className="h-3 w-3" />
          {toastMessage}
        </div>
      )}

      {/* 快捷建议 — 靠左 */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {chips.map((chip) => (
          <button
            key={chip.text}
            onClick={() => handleChipClick(chip.text)}
            disabled={isLoading}
            className="rounded-full border border-border/60 bg-card px-2.5 py-1 text-[11px] text-muted-foreground transition-all hover:border-indigo-200 hover:bg-indigo-50/40 hover:text-indigo-600 hover:shadow-sm disabled:opacity-40"
          >
            {chip.icon} {chip.text}
          </button>
        ))}
      </div>

      {/* 输入框容器 — 圆润药丸 */}
      <div className="flex items-center gap-1.5 rounded-[22px] border border-border/60 bg-card px-3 py-1.5 shadow-sm transition-all focus-within:border-indigo-300/80 focus-within:shadow-md focus-within:ring-2 focus-within:ring-indigo-50">
        {/* 附件 */}
        <button
          type="button"
          disabled
          title="添加文件（即将上线）"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground/40 transition-colors hover:bg-accent hover:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Paperclip className="h-4 w-4" />
        </button>

        {/* 输入区域 */}
        <label htmlFor="ai-chat-input" className="sr-only">输入你的问题</label>
        <textarea
          ref={textareaRef}
          id="ai-chat-input"
          rows={1}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
          }}
          onKeyDown={handleKeyDown}
          placeholder={isLoading ? '小语正在思考...' : '问小语点什么好呢...'}
          disabled={isLoading}
          className="min-h-[22px] flex-1 resize-none bg-transparent py-0.5 text-[13px] leading-snug text-foreground/90 outline-none placeholder:text-muted-foreground/40 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ maxHeight: '100px' }}
        />

        {/* 语音 */}
        <button
          type="button"
          disabled
          title="语音输入（即将上线）"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground/40 transition-colors hover:bg-accent hover:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Mic className="h-4 w-4" />
        </button>

        {/* 发送 / 停止 */}
        {isLoading ? (
          <button
            onClick={onStop}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition-all hover:bg-red-600 active:scale-90"
            aria-label="停止生成"
          >
            <Square className="h-3 w-3" aria-hidden="true" />
          </button>
        ) : (
          <button
            onClick={onSend}
            disabled={!value.trim()}
            aria-label="发送消息"
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-150 active:scale-90',
              value.trim()
                ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700'
                : 'bg-muted/60 text-muted-foreground/40',
            )}
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      <p className="mt-2.5 text-center text-[10px] text-muted-foreground/50">
        小语可能会犯错，请核实重要信息 · Shift+Enter 换行
      </p>
    </div>
  );
}
