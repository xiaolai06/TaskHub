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
    // 开发环境允许所有 localhost
    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      callback(null, true);
    } else {
      callback(null, config.frontendUrl);
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
