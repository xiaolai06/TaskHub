/**
 * 带超时的 fetch 封装
 * 所有外部 API 调用统一使用此函数，避免无限阻塞
 */
export async function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  timeoutMs = 10000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`请求超时（${timeoutMs / 1000}秒）: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
