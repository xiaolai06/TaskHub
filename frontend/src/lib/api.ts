export const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

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

async function safeParseJSON(res: Response): Promise<ApiResponse> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text().catch(() => '无法读取响应内容');
    const preview = text.slice(0, 200);
    const hint = text.startsWith('<!DOCTYPE') || text.startsWith('<html')
      ? '\n\n可能原因：\n1. 后端服务未启动，请在 backend 目录运行 npm run dev\n2. NEXT_PUBLIC_API_URL 配置错误\n3. 请求被前端路由或代理拦截'
      : '';
    throw new ApiError(`服务端返回了非 JSON 响应 (HTTP ${res.status})${hint}\n\n响应预览: ${preview}`, 'NON_JSON_RESPONSE', res.status);
  }

  try {
    return await res.json();
  } catch {
    throw new ApiError(`JSON 解析失败 (HTTP ${res.status})`, 'JSON_PARSE_ERROR', res.status);
  }
}

let isRedirecting = false;

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
    throw new ApiError(
      `无法连接到后端服务\n\n请确认：\n1. 后端已启动：cd backend && npm run dev\n2. 后端端口是 3001\n3. API 地址: ${API_BASE}\n4. 原始错误: ${err instanceof Error ? err.message : String(err)}`,
      'NETWORK_ERROR',
      0,
    );
  }

  const json = await safeParseJSON(res);
  if (!json.success) {
    if (res.status === 401 && typeof window !== 'undefined' && !isRedirecting) {
      isRedirecting = true;
      window.location.href = '/auth-pages/login';
    }
    throw new ApiError(json.error?.message || '请求失败', json.error?.code || 'UNKNOWN_ERROR', res.status, json.error?.details);
  }
  return json.data as T;
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, data?: unknown) => request<T>(endpoint, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  put: <T>(endpoint: string, data?: unknown) => request<T>(endpoint, { method: 'PUT', body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(endpoint: string, data?: unknown) => request<T>(endpoint, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};