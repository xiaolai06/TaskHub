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

/** 面向用户的友好错误消息映射 */
const ERROR_MESSAGES: Record<string, string> = {
  CAPTCHA_INVALID: '验证码错误或已失效，请重新输入',
  EMAIL_EXISTS: '该邮箱已被注册，请直接登录或使用其他邮箱',
  INVALID_CREDENTIALS: '邮箱或密码错误，请检查后重试',
  NOT_FOUND: '请求的资源不存在',
  CODE_EXPIRED: '邮箱验证码已过期，请重新获取',
  CODE_MAX_ATTEMPTS: '验证码错误次数过多，请重新获取',
  CODE_INVALID: '邮箱验证码错误，请检查后重试',
  INVALID_PASSWORD: '原密码错误',
  PASSWORD_REUSE: '新密码不能与原密码相同',
  VALIDATION_ERROR: '提交的信息有误，请检查标红的字段',
  RATE_LIMITED: '操作太频繁，请稍后再试',
  NETWORK_ERROR: '无法连接到服务器，请检查网络',
};

/** 根据错误 code 获取用户友好提示 */
export function getFriendlyMessage(code: string, fallback: string): string {
  return ERROR_MESSAGES[code] || fallback;
}

/** 传递给 api 方法的选项 */
export interface ApiRequestOptions {
  signal?: AbortSignal;
}

/** GET 请求的额外选项（含查询参数） */
export interface ApiGetOptions extends ApiRequestOptions {
  params?: Record<string, string | number | boolean | undefined>;
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
let redirectResetTimer: ReturnType<typeof setTimeout> | null = null;

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
    // AbortError 直接抛出，让调用方自行处理（验证码快速切换等场景）
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    throw new ApiError(
      '无法连接到服务器，请检查网络是否正常',
      'NETWORK_ERROR',
      0,
    );
  }

  const json = await safeParseJSON(res);
  if (!json.success) {
    if (res.status === 401 && typeof window !== 'undefined' && !isRedirecting) {
      isRedirecting = true;
      window.location.href = '/auth-pages/login';
      // 5 秒后重置标志，允许下次 401 再次触发跳转（登录回来后）
      if (redirectResetTimer) clearTimeout(redirectResetTimer);
      redirectResetTimer = setTimeout(() => { isRedirecting = false; }, 5000);
    }
    throw new ApiError(json.error?.message || '请求失败', json.error?.code || 'UNKNOWN_ERROR', res.status, json.error?.details);
  }
  return json.data as T;
}

export const api = {
  get: <T>(endpoint: string, opts?: ApiGetOptions) => {
    let url = endpoint;
    if (opts?.params) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(opts.params)) {
        if (v !== undefined && v !== '') qs.set(k, String(v));
      }
      const qsStr = qs.toString();
      if (qsStr) url += `?${qsStr}`;
    }
    return request<T>(url, { signal: opts?.signal });
  },
  post: <T>(endpoint: string, data?: unknown, opts?: ApiRequestOptions) =>
    request<T>(endpoint, { method: 'POST', body: data ? JSON.stringify(data) : undefined, signal: opts?.signal }),
  put: <T>(endpoint: string, data?: unknown, opts?: ApiRequestOptions) =>
    request<T>(endpoint, { method: 'PUT', body: data ? JSON.stringify(data) : undefined, signal: opts?.signal }),
  patch: <T>(endpoint: string, data?: unknown, opts?: ApiRequestOptions) =>
    request<T>(endpoint, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined, signal: opts?.signal }),
  delete: <T>(endpoint: string, opts?: ApiRequestOptions) =>
    request<T>(endpoint, { method: 'DELETE', signal: opts?.signal }),
};