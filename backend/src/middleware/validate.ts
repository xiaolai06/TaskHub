import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { error } from '../utils/response';

type RequestPart = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, part: RequestPart = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = schema.parse(req[part]);
      // query/params 在 Express 5 中是只读 getter，挂到 validated 自定义属性
      if (part === 'body') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Express req type doesn't include validated properties
        (req as any)[part] = result;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Express req type doesn't include validated properties
        (req as any).validated = (req as any).validated || {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Express req type doesn't include validated properties
        (req as any).validated[part] = result;
      }
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
