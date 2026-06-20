/**
 * 验证码跨页面缓存
 *
 * 问题：登录/注册/忘记密码三个页面互相切换时，每次切换组件销毁重建，
 * captchaSvg 初始为空 → 必然出现 loading spinner。网络慢或切换太快时甚至加载失败。
 *
 * 方案：模块级单例缓存最近一次验证码数据。页面挂载时优先从缓存读，
 * 只有缓存过期或不存在时才发请求。组件卸载不影响缓存。
 */

interface CachedCaptcha {
  captchaId: string;
  svg: string;
  cachedAt: number;
}

/** 缓存有效期 4 分钟（后端 TTL 是 5 分钟，留 1 分钟安全余量） */
const CACHE_TTL_MS = 4 * 60 * 1000;

let cache: CachedCaptcha | null = null;

/** 读取缓存，过期返回 null */
export function getCachedCaptcha(): { captchaId: string; svg: string } | null {
  if (!cache) return null;
  if (Date.now() - cache.cachedAt > CACHE_TTL_MS) {
    cache = null;
    return null;
  }
  return { captchaId: cache.captchaId, svg: cache.svg };
}

/** 写入缓存 */
export function setCachedCaptcha(captchaId: string, svg: string): void {
  cache = { captchaId, svg, cachedAt: Date.now() };
}

/** 清除缓存（验证码校验失败后调用，强制下次获取新验证码） */
export function clearCachedCaptcha(): void {
  cache = null;
}
