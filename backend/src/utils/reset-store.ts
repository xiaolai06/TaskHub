import { randomInt } from 'crypto';

interface ResetEntry {
  code: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

/** 内存存储重置码，key = email（小写） */
const store = new Map<string, ResetEntry>();

const CODE_TTL_MS = 10 * 60 * 1000; // 10 分钟过期
const MAX_ATTEMPTS = 5;              // 最多验证 5 次
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 秒重发冷却

/** 清理过期条目 */
function cleanup(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt < now) store.delete(key);
  }
}

/**
 * 生成并存储重置码
 * @returns { code, ok } — ok=false 表示还在冷却期内
 */
export function createResetCode(email: string): { code: string; ok: boolean } {
  cleanup();

  const key = email.toLowerCase();
  const existing = store.get(key);

  // 60 秒冷却
  if (existing && Date.now() - existing.lastSentAt < RESEND_COOLDOWN_MS) {
    return { code: existing.code, ok: false };
  }

  // 生成 6 位数字验证码（用 crypto 安全随机数）
  const code = String(randomInt(100000, 999999));

  store.set(key, {
    code,
    expiresAt: Date.now() + CODE_TTL_MS,
    attempts: 0,
    lastSentAt: Date.now(),
  });

  return { code, ok: true };
}

/**
 * 校验重置码
 * @returns 'ok' | 'expired' | 'invalid' | 'max_attempts'
 */
export function verifyResetCode(email: string, input: string): 'ok' | 'expired' | 'invalid' | 'max_attempts' {
  const key = email.toLowerCase();
  const entry = store.get(key);
  if (!entry) return 'expired';
  if (entry.expiresAt < Date.now()) { store.delete(key); return 'expired'; }
  if (entry.attempts >= MAX_ATTEMPTS) { store.delete(key); return 'max_attempts'; }

  entry.attempts++;

  if (entry.code !== input.trim()) return 'invalid';

  store.delete(key); // 一次性使用
  return 'ok';
}
