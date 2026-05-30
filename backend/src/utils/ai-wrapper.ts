// TODO: AI 调用安全包装器 - 失败自动降级 Mock
export async function safeAiCall<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  return fallback;
}
