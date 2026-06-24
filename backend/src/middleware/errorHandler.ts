import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { error } from '../utils/response';
import logger from '../utils/logger';

interface PrismaError extends Error {
  code: string;
  meta?: Record<string, unknown>;
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  // 已知业务错误
  if (err instanceof AppError) {
    logger.debug({ code: err.code, statusCode: err.statusCode, path: _req.path }, err.message);
    error(res, err.code, err.message, err.statusCode);
    return;
  }

  // Prisma 错误
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as PrismaError;
    if (prismaErr.code === 'P2002') {
      error(res, 'CONFLICT', '数据已存在（唯一约束冲突）', 409);
      return;
    }
    if (prismaErr.code === 'P2025') {
      error(res, 'NOT_FOUND', '记录不存在', 404);
      return;
    }
  }

  // JWT 错误
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    error(res, 'UNAUTHORIZED', 'Token 无效或已过期', 401);
    return;
  }

  // 未知错误
  logger.error({ err }, '未捕获错误');
  error(res, 'INTERNAL_ERROR', '服务器内部错误', 500);
}
