import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';

const app = express();

// ============ 信任代理 ============
// Nginx / Docker / 云负载均衡 反代时，需要信任 X-Forwarded-For
// TRUST_PROXY 环境变量控制：'1' = 信任第一层代理，'false' = 不信任
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy && trustProxy !== 'false') {
  app.set('trust proxy', parseInt(trustProxy, 10) || 1);
}

// ============ 中间件 ============
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
      console.warn(`[CORS] 拒绝来源: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ============ 静态文件（生产环境可选） ============
// 如果需要直接托管前端构建产物，取消注释：
// app.use(express.static('../frontend/out'));

// ============ 路由 ============
app.use('/api', routes);

// ============ 错误处理 ============
app.use(errorHandler);

export default app;
