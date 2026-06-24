// WARNING: This module imports config.ts. Do NOT import logger into config.ts
// or into any utility that config.ts transitively imports — it will cause a
// circular dependency and produce undefined values.
import pino from 'pino';
import { config } from '../config';

const isProd = config.nodeEnv === 'production';

const logger = pino({
  level: isProd ? 'info' : 'debug',
  // 生产环境 JSON（便于日志收集），开发环境 pino-pretty 可读格式
  transport: !isProd
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
    : undefined,
  redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.apiKey', '*.api_key', '*.token'],
});

export default logger;
