import { randomUUID } from 'crypto';

interface CaptchaEntry {
  text: string;
  expiresAt: number;
}

/** 内存存储验证码，key = captchaId，5 分钟过期 */
const store = new Map<string, CaptchaEntry>();

const TTL_MS = 5 * 60 * 1000; // 5 分钟

/** 清理过期条目（每次生成时触发） */
function cleanup(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt < now) {
      store.delete(key);
    }
  }
}

/**
 * 生成验证码记录
 * @param externalText - 外部传入的验证码文字（如 svg-captcha 生成的）
 *                       若不传则自动生成 4 位随机字符
 */
export function createCaptcha(externalText?: string): { captchaId: string; text: string } {
  cleanup();

  const captchaId = randomUUID();
  let text: string;

  if (externalText) {
    text = externalText.toLowerCase();
  } else {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    text = '';
    for (let i = 0; i < 4; i++) {
      text += chars[Math.floor(Math.random() * chars.length)];
    }
    text = text.toLowerCase();
  }

  store.set(captchaId, { text, expiresAt: Date.now() + TTL_MS });
  return { captchaId, text };
}

/** 校验验证码（一次性，验证后立即删除） */
export function verifyCaptcha(captchaId: string, input: string): boolean {
  const entry = store.get(captchaId);
  if (!entry) return false;

  store.delete(captchaId); // 一次性使用

  if (entry.expiresAt < Date.now()) return false;

  return entry.text === input.toLowerCase().trim();
}
