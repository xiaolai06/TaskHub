import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';

const app = express();

// ============ 中间件 ============
app.use(cors({
  origin: (origin, callback) => {
    // 无 origin（同源请求/服务端调用）或开发环境 localhost → 放行
    if (!origin || (config.nodeEnv !== 'production' && (origin.includes('localhost') || origin.includes('127.0.0.1')))) {
      callback(null, true);
    } else {
      // 生产环境只允许 FRONTEND_URL 配置的域名
      const allowed = config.frontendUrl.split(',').some(u => origin === u.trim());
      callback(null, allowed ? origin : false);
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ============ 路由 ============
app.use('/api', routes);

// ============ 错误处理 ============
app.use(errorHandler);

export default app;
