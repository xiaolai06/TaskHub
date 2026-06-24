import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { randomUUID } from 'node:crypto';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';
import logger from './utils/logger';

const app = express();

// ============ 信任代理 ============
// Nginx / Docker / 云负载均衡 反代时，需要信任 X-Forwarded-For
// TRUST_PROXY 环境变量控制：'1' = 信任第一层代理，'false' = 不信任
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy && trustProxy !== 'false') {
  app.set('trust proxy', parseInt(trustProxy, 10) || 1);
}

// ============ 安全头 ============
app.use(helmet({
  contentSecurityPolicy: false, // 由前端 Nginx 层处理 CSP
  crossOriginEmbedderPolicy: false,
}));

// ============ 跨域 ============
app.use(cors({
  origin: (origin, callback) => {
    // 无 origin（同源请求/服务端调用/curl）→ 放行
    if (!origin) {
      callback(null, true);
      return;
    }

    // 开发环境：允许 localhost
    if (config.nodeEnv !== 'production') {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        callback(null, true);
        return;
      }
    }

    // 生产环境：只允许 FRONTEND_URL 中配置的域名
    const allowed = config.frontendUrl
      .split(',')
      .map(u => u.trim())
      .some(u => origin === u);

    if (allowed) {
      callback(null, origin);
    } else {
      logger.warn({ origin }, 'CORS 拒绝来源');
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ============ 请求日志（安全头和 CORS 之后、路由之前） ============
app.use(pinoHttp({
  logger,
  genReqId: (req) => (req.headers['x-request-id'] as string) || randomUUID(),
  // 304 缓存命中不记录（减少噪音）
  autoLogging: {
    ignore: (req) => req.url === '/api/health',
  },
  // 自定义成功日志格式：只显示路径（不含查询参数）
  customSuccessMessage: (req, res) => {
    const path = req.url?.split('?')[0] || req.url;
    return `${req.method} ${path} ${res.statusCode}`;
  },
  customErrorMessage: (req, res) => {
    const path = req.url?.split('?')[0] || req.url;
    return `${req.method} ${path} ${res.statusCode}`;
  },
  // 只记录关键字段，去掉 headers 噪音
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      id: req.id,
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip,
    }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
  // 304 不记录响应体
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 400 || err) return 'error';
    if (res.statusCode >= 300) return 'silent'; // 304 等不记录
    return 'info';
  },
}));

// ============ 响应压缩 ============
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  threshold: 1024, // only compress responses > 1KB
}));

// ============ 请求体解析 ============
// 默认 1MB，特殊路由（如 AI 聊天、文件处理）单独加大
app.use(express.json({ limit: '1mb' }));
// API 只接受 JSON，关闭 urlencoded 防原型污染
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ============ 静态文件（生产环境可选） ============
// 如果需要直接托管前端构建产物，取消注释：
// app.use(express.static('../frontend/out'));

// ============ 路由 ============
app.use('/api', routes);

// ============ 错误处理 ============
app.use(errorHandler);

export default app;
