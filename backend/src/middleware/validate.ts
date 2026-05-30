import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { error } from '../utils/response';

type RequestPart = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, part: RequestPart = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = schema.parse(req[part]);
      // 将校验后的数据替换回去（Zod 可能做了类型转换）
      (req as any)[part] = result;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        error(res, 'VALIDATION_ERROR', '请求参数校验失败', 400, details);
        return;
      }
      next(err);
    }
  };
}
