const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * API 错误类 - 携带服务器返回的完整错误信息
 */
export class ApiError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, code: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * 安全地解析响应体为 JSON
 * 如果不是 JSON 格式（如 HTML 错误页），给出明确的错误提示
 */
async function safeParseJSON(res: Response): Promise<ApiResponse> {
  const contentType = res.headers.get('content-type') || '';

  // 检查响应类型是否为 JSON
  if (!contentType.includes('application/json')) {
    // 尝试读取非 JSON 内容的前 200 个字符用于调试
    const text = await res.text().catch(() => '无法读取响应内容');
    const preview = text.slice(0, 200);

    // 诊断不同场景并给出具体建议
    let hint = '';
    if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
      hint = '\n\n💡 可能的原因：\n'
        + '1. 后端服务未启动 → 在 backend 目录运行 npm run dev\n'
        + '2. API 地址配置错误 → 检查 frontend/.env.local 中的 NEXT_PUBLIC_API_URL\n'
        + '3. Next.js 代理了 API 请求 → 确认请求没有被前端路由拦截';
    }

    throw new ApiError(
      `服务器返回了非 JSON 响应 (HTTP ${res.status})${hint}\n\n响应预览: ${preview}`,
      'NON_JSON_RESPONSE',
      res.status,
    );
  }

  // 正常 JSON 解析
  try {
    return await res.json();
  } catch {
    throw new ApiError(
      `JSON 解析失败 (HTTP ${res.status})，响应内容可能已损坏`,
      'JSON_PARSE_ERROR',
      res.status,
    );
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const config: RequestInit = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  let res: Response;
  try {
    res = await fetch(url, config);
  } catch (err) {
    // 网络错误 — 通常是后端没启动
    throw new ApiError(
      '无法连接到服务器\n\n💡 请确认：\n'
      + '1. 后端是否已启动（cd backend && npm run dev）\n'
      + '2. 后端端口是否为 3001\n'
      + `3. API 地址: ${API_BASE}\n`
      + `4. 原始错误: ${err instanceof Error ? err.message : String(err)}`,
      'NETWORK_ERROR',
      0,
    );
  }

  const json = await safeParseJSON(res);

  if (!json.success) {
    // 401 自动跳转登录页（避免反复弹"未登录"）
    if (res.status === 401 && typeof window !== 'undefined') {
      window.location.href = '/auth-pages/login';
    }
    throw new ApiError(
      json.error?.message || '请求失败',
      json.error?.code || 'UNKNOWN_ERROR',
      res.status,
      json.error?.details,
    );
  }

  return json.data as T;
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),

  post: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE' }),
};
