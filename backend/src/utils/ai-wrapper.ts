/**
 * AI 调用安全包装器 — 失败时自动降级到 fallback 值
 */
import logger from './logger';
export async function safeAiCall<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    logger.error({ err }, 'safeAiCall AI 调用失败，使用降级值');
    return fallback;
  }
}
