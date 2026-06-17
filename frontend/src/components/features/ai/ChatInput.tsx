'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Send, Square, Check, Mic, MicOff, Paperclip, Loader2, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FilePreview } from './FilePreview';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onSendWithFiles?: (files: File[]) => void;
  onStop: () => void;
  isLoading: boolean;
  toastMessage?: string | null;
}

interface FileWithPreview { file: File; preview?: string }

const DEFAULT_CHIPS: { icon: string; text: string }[] = [
  { icon: '✨', text: '今日简报' },
  { icon: '📊', text: '项目进度' },
  { icon: '👤', text: '客户分析' },
];

function getTimeChips(): { icon: string; text: string }[] {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 10) return [{ icon: '🌅', text: '今日简报' }, { icon: '📋', text: '查看任务' }, { icon: '⚠️', text: '风险扫描' }];
  if (hour >= 10 && hour < 17) return [{ icon: '📝', text: '创建任务' }, { icon: '⏱', text: '记录工时' }, { icon: '📞', text: '客户跟进' }];
  if (hour >= 17 && hour < 22) return [{ icon: '🌙', text: '今日总结' }, { icon: '📅', text: '明日计划' }, { icon: '💰', text: '财务概览' }];
  return DEFAULT_CHIPS;
}

export function ChatInput({ value, onChange, onSend, onSendWithFiles, onStop, isLoading, toastMessage }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [chips, setChips] = useState(DEFAULT_CHIPS);
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [networkStatus, setNetworkStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [checkingNetwork, setCheckingNetwork] = useState(false);

  // 客户端挂载后再根据实际时间更新 chips，避免 SSR hydration 不匹配
  useEffect(() => {
    setChips(getTimeChips());
  }, []);

  // 网络状态自动消失（2 秒）
  useEffect(() => {
    if (!networkStatus) return;
    const t = setTimeout(() => setNetworkStatus(null), 2000);
    return () => clearTimeout(t);
  }, [networkStatus]);

  // 语音识别（MediaRecorder 录音 + 后端 Whisper API）
  const speech = useSpeechRecognition({
    onResult: (text) => {
      onChange(value ? value + ' ' + text : text);
      setTimeout(() => textareaRef.current?.focus(), 0);
    },
  });

  // 网络诊断
  async function handleCheckNetwork() {
    setCheckingNetwork(true);
    try {
      const result = await speech.checkNetwork();
      setNetworkStatus({ ok: result.success, msg: result.message });
    } catch {
      setNetworkStatus({ ok: false, msg: '诊断失败' });
    } finally {
      setCheckingNetwork(false);
    }
  }

  // 录音中或识别中：显示 partialText；否则显示输入值
  const isVoiceActive = speech.isListening || speech.isTranscribing;
  const displayText = isVoiceActive ? speech.partialText : value;

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    if (!isVoiceActive) {
      onChange(e.target.value);
    }
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && !isVoiceActive && (displayText.trim() || files.length > 0)) handleSend();
    }
  }

  function handleChipClick(text: string) {
    onChange(text);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function handleSend() {
    if (files.length > 0 && onSendWithFiles) {
      onSendWithFiles(files.map(f => f.file));
      setFiles([]);
    } else {
      onSend();
    }
  }

  const ALLOWED_MIME = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ];

  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    const valid: FileWithPreview[] = [];
    for (const file of Array.from(selectedFiles)) {
      const isImage = file.type.startsWith('image/');
      const isAllowed = isImage || ALLOWED_MIME.includes(file.type);
      if (!isAllowed) continue;
      if (file.size > 20 * 1024 * 1024) continue;
      const item: FileWithPreview = { file };
      if (isImage) item.preview = URL.createObjectURL(file);
      valid.push(item);
    }
    setFiles(prev => [...prev, ...valid]);
  }, []);

  function handleRemoveFile(index: number) {
    setFiles(prev => {
      const r = prev[index];
      if (r.preview) URL.revokeObjectURL(r.preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  return (
    <div className="shrink-0 px-4 pb-3.5 pt-1.5" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handleFileSelect(e.dataTransfer.files); }}>
      {toastMessage && (
        <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-emerald-50/70 px-2.5 py-1.5 text-2xs text-emerald-700 animate-in fade-in slide-in-from-left-2">
          <Check className="h-3 w-3" />{toastMessage}
        </div>
      )}

      <FilePreview files={files} onRemove={handleRemoveFile} />

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {chips.map((chip) => (
          <button key={chip.text} onClick={() => handleChipClick(chip.text)} disabled={isLoading}
            className="rounded-full border border-border/60 bg-card px-2.5 py-1 text-2xs-plus text-muted-foreground transition-all hover:border-indigo-200 hover:bg-indigo-50/40 hover:text-indigo-600 hover:shadow-sm disabled:opacity-40">
            {chip.icon} {chip.text}
          </button>
        ))}
      </div>

      <div className="relative flex items-center gap-1.5 rounded-[22px] border border-border/60 bg-card px-3 py-1.5 shadow-sm transition-all focus-within:border-indigo-300/80 focus-within:shadow-md focus-within:ring-2 focus-within:ring-indigo-50">
        {/* 附件 */}
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading || isVoiceActive}
          title="添加文件（图片/PDF/Word/Excel/TXT）"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-accent hover:text-muted-foreground disabled:opacity-30">
          <Paperclip className="h-4 w-4" />
        </button>
        <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.docx,.xlsx,.txt" onChange={e => handleFileSelect(e.target.files)} className="hidden" />

        {/* 输入框 */}
        <label htmlFor="ai-chat-input" className="sr-only">输入你的问题</label>
        <textarea
          ref={textareaRef} id="ai-chat-input" rows={1} value={displayText}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={
            speech.isListening ? '请说话，说完点击停止...' :
            speech.isTranscribing ? '正在识别...' :
            isLoading ? '小语正在思考...' :
            '问小语点什么好呢...'
          }
          disabled={isLoading || isVoiceActive}
          className={cn(
            'min-h-[22px] flex-1 resize-none bg-transparent py-0.5 text-sm leading-snug outline-none disabled:opacity-50',
            speech.isListening ? 'text-red-600 font-medium placeholder:text-red-400/60' :
            speech.isTranscribing ? 'text-indigo-600 placeholder:text-indigo-400/60' :
            'text-foreground/90 placeholder:text-muted-foreground/40',
          )}
          style={{ maxHeight: '100px' }}
        />

        {/* 语音识别按钮 */}
        <button type="button"
          onClick={() => { setNetworkStatus(null); speech.toggle(); }}
          disabled={isLoading}
          title={
            speech.isListening ? '点击停止录音并识别' :
            speech.isTranscribing ? '点击取消识别' :
            speech.mode === 'whisper' ? '语音输入（Whisper API）' :
            '语音输入'
          }
          className={cn(
            'relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-200',
            speech.isListening
              ? 'bg-red-500 text-white shadow-md animate-pulse hover:bg-red-600'
              : speech.isTranscribing
              ? 'bg-indigo-100 text-indigo-600'
              : 'text-muted-foreground/60 hover:bg-accent hover:text-muted-foreground disabled:opacity-30',
          )}>
          {speech.isListening ? <MicOff className="h-4 w-4" /> :
           speech.isTranscribing ? <Loader2 className="h-4 w-4 animate-spin" /> :
           <Mic className="h-4 w-4" />}
        </button>

        {/* 错误提示 + 网络诊断 */}
        {(speech.error || networkStatus) && (
          <div className="absolute bottom-full left-0 right-0 mb-1.5 z-10">
            {speech.error && (
              <div className="flex items-center gap-2 px-3 py-2 text-2xs-plus text-red-600 bg-red-50/90 rounded-lg border border-red-100/50 backdrop-blur-sm">
                <span className="flex-1">{speech.error}</span>
                <button onClick={handleCheckNetwork} disabled={checkingNetwork}
                  className="shrink-0 inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 underline underline-offset-2 disabled:opacity-50">
                  {checkingNetwork ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wifi className="h-3 w-3" />}
                  {checkingNetwork ? '测速中...' : '测速'}
                </button>
              </div>
            )}
            {networkStatus && (
              <div className={cn(
                'mt-1 flex items-center gap-1.5 px-3 py-2 text-2xs-plus rounded-lg border backdrop-blur-sm',
                networkStatus.ok
                  ? 'text-emerald-700 bg-emerald-50/90 border-emerald-100/50'
                  : 'text-amber-700 bg-amber-50/90 border-amber-100/50',
              )}>
                {networkStatus.ok ? <Wifi className="h-3 w-3 shrink-0" /> : <WifiOff className="h-3 w-3 shrink-0" />}
                {networkStatus.msg}
              </div>
            )}
          </div>
        )}

        {/* 发送 / 停止 */}
        {isLoading ? (
          <button onClick={onStop} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition-all hover:bg-red-600 active:scale-90">
            <Square className="h-3 w-3" />
          </button>
        ) : (
          <button onClick={handleSend} disabled={(!displayText.trim() && files.length === 0) || isVoiceActive}
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-150 active:scale-90',
              (displayText.trim() || files.length > 0) && !isVoiceActive ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700' : 'bg-muted/60 text-muted-foreground/40',
            )}>
            <Send className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <p className="mt-2.5 text-center text-2xs text-muted-foreground/50">
        小语可能会犯错，请核实重要信息 · Shift+Enter 换行
      </p>
    </div>
  );
}
