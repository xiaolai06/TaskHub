import { Response } from 'express';

export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function success<T>(res: Response, data: T, message?: string, statusCode = 200): void {
  const body: SuccessResponse<T> = { success: true, data };
  if (message) body.message = message;
  res.status(statusCode).json(body);
}

export function error(res: Response, code: string, message: string, statusCode = 400, details?: unknown): void {
  const body: ErrorResponse = {
    success: false,
    error: { code, message },
  };
  if (details) body.error.details = details;
  res.status(statusCode).json(body);
}
