'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * 语音识别 — 后端 Whisper API：
 *   录音 → 上传 → 识别，需在设置中配置 STT 服务
 */

interface UseSpeechRecognitionOptions {
  onResult?: (text: string) => void;
}

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  isTranscribing: boolean;
  isReady: boolean;
  isModelLoading: boolean;
  downloadProgress: number;
  partialText: string;
  error: string | null;
  toggle: () => void;
  stop: () => void;
  mode: 'whisper' | 'none';
  checkNetwork: () => Promise<{ success: boolean; message: string; latencyMs: number }>;
}

// ═══ 工具函数 ═══

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const PREFERRED_MIME = [
  'audio/webm;codecs=opus', 'audio/webm',
  'audio/ogg;codecs=opus', 'audio/mp4',
];

function getSupportedMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const mime of PREFERRED_MIME) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return null;
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ═══ Hook ═══

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionReturn {
  const { onResult } = options;

  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [partialText, setPartialText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'whisper' | 'none'>('none');

  // 错误自动消失（1.5 秒）
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 1500);
    return () => clearTimeout(t);
  }, [error]);

  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ═══ 初始化 ═══

  useEffect(() => {
    if (getSupportedMime()) {
      setMode('whisper');
    } else {
      setMode('none');
      setError('浏览器不支持录音，请使用 Chrome 或 Edge');
    }
  }, []);

  // ═══ 录音计时 ═══

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setPartialText(`🎤 录音中 ${formatDuration(Date.now() - startTimeRef.current)}`);
    }, 200);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  // ═══ 语音识别（后端 API） ═══

  const transcribeViaApi = useCallback(async (blob: Blob) => {
    setIsTranscribing(true);
    setPartialText('🔍 正在识别...');
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const form = new FormData();
      form.append('audio', blob, `recording.${blob.type.includes('webm') ? 'webm' : 'ogg'}`);

      const resp = await fetch(`${API_BASE}/llm/speech/transcribe`, {
        method: 'POST', body: form, credentials: 'include', signal: controller.signal,
      });
      const json = await resp.json();
      if (!resp.ok || !json.success) throw new Error(json.error?.message || `识别失败 (${resp.status})`);

      const text: string = json.data?.text || '';
      if (text.trim()) {
        onResultRef.current?.(text.trim());
      } else {
        setError('未识别到有效语音，请靠近麦克风再试');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : '语音识别失败';
      if (msg.includes('未配置') || msg.includes('STT_NOT_CONFIGURED')) {
        setError('未配置语音识别服务，请在设置 → 语音识别中添加供应商');
      } else {
        setError(msg);
      }
    } finally {
      setIsTranscribing(false);
      setPartialText('');
      abortRef.current = null;
    }
  }, []);

  const startWhisperRecording = useCallback(async () => {
    setError(null);
    setPartialText('🎤 请求麦克风...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const mimeType = getSupportedMime() || 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stopTimer();
        const blob = new Blob(chunksRef.current, { type: mimeType });
        cleanupStream();
        if (blob.size < 1000) { setError('录音太短，请长按说话'); return; }
        transcribeViaApi(blob);
      };
      recorderRef.current = recorder;
      recorder.start(100);
      setIsListening(true);
      startTimer();
    } catch (err) {
      cleanupStream();
      if ((err as Error)?.name === 'NotAllowedError') {
        setError('麦克风权限被拒绝，请在浏览器设置中允许');
      } else {
        setError(err instanceof Error ? err.message : '无法访问麦克风');
      }
      setPartialText('');
    }
  }, [startTimer, stopTimer, cleanupStream, transcribeViaApi]);

  // ═══ 公共控制 ═══

  const startListening = useCallback(() => {
    if (isListening || isTranscribing) return;
    if (mode === 'whisper') startWhisperRecording();
    else setError('浏览器不支持录音，请使用 Chrome 或 Edge');
  }, [isListening, isTranscribing, mode, startWhisperRecording]);

  const stopListening = useCallback(() => {
    if (mode === 'whisper') {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    }
    setIsListening(false);
  }, [mode]);

  const toggle = useCallback(() => {
    if (isListening) stopListening();
    else if (isTranscribing) {
      abortRef.current?.abort();
      setIsTranscribing(false);
      setPartialText('');
    }
    else startListening();
  }, [isListening, isTranscribing, startListening, stopListening]);

  const checkNetwork = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/llm/speech/test`, {
        method: 'POST', credentials: 'include',
      });
      const json = await resp.json();
      return json.data || { success: false, message: '测速失败', latencyMs: -1 };
    } catch {
      return { success: false, message: '无法连接后端服务', latencyMs: -1 };
    }
  }, []);

  // 清理
  useEffect(() => () => {
    stopTimer();
    cleanupStream();
    abortRef.current?.abort();
  }, [stopTimer, cleanupStream]);

  return {
    isListening,
    isTranscribing,
    isReady: mode !== 'none',
    isModelLoading: false,
    downloadProgress: 100,
    partialText,
    error,
    toggle,
    stop: stopListening,
    mode,
    checkNetwork,
  };
}
