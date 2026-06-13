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

/**
 * 带代理的 fetch
 * @param proxyUrl 代理地址（由调用方从 proxy-config 服务获取）
 *                  传 undefined 或空串时自动回退到直连
 */
export async function fetchWithProxy(
  url: string,
  proxyUrl: string | undefined,
  opts: RequestInit = {},
  timeoutMs = 10_000,
): Promise<Response> {
  if (!proxyUrl) return fetchWithTimeout(url, opts, timeoutMs);

  const { ProxyAgent } = await import('undici');
  const dispatcher = new ProxyAgent(proxyUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...opts,
      signal: controller.signal,
      // @ts-expect-error -- undici dispatcher 属性在 Node.js fetch 类型中未声明
      dispatcher,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`请求超时（${timeoutMs / 1000}秒）: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
