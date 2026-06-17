import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { error } from '../utils/response';

// 简单的内存限频器（生产环境建议用 Redis）
const requestCounts = new Map<string, { count: number; resetTime: number }>();

// 定期清理过期记录，防止长期运行时内存泄漏
const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 分钟
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestCounts) {
    if (now > record.resetTime) requestCounts.delete(key);
  }
}, CLEANUP_INTERVAL);

interface RateLimitOptions {
  windowMs: number;   // 时间窗口（毫秒）
  max: number;        // 最大请求数
  message?: string;   // 超限提示
}

/**
 * 接口限频中间件
 * 基于 IP 地址的滑动窗口限频
 */
export function rateLimit(options: RateLimitOptions) {
  const { windowMs, max, message = '请求过于频繁，请稍后再试' } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    // 开发环境可关闭限频
    if (!config.limitEnabled) {
      next();
      return;
    }

    const key = req.ip || 'unknown';
    const now = Date.now();
    const record = requestCounts.get(key);

    if (!record || now > record.resetTime) {
      // 新窗口
      requestCounts.set(key, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    record.count++;
    if (record.count > max) {
      error(res, 'RATE_LIMITED', message, 429);
      return;
    }

    next();
  };
}

// 预设限频规则
export const loginLimit = rateLimit({
  windowMs: 60 * 1000,  // 1 分钟
  max: 5,               // 最多 5 次
  message: '登录尝试过于频繁，请 1 分钟后再试',
});

export const registerLimit = rateLimit({
  windowMs: 60 * 1000,  // 1 分钟
  max: 3,               // 最多 3 次
  message: '注册过于频繁，请 1 分钟后再试',
});

export const apiLimit = rateLimit({
  windowMs: 60 * 1000,  // 1 分钟
  max: 60,              // 最多 60 次
  message: '接口请求过于频繁，请稍后再试',
});
