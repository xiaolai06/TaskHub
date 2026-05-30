import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';

const app = express();

// ============ 中间件 ============
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,  // 允许 Cookie 跨域
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ============ 路由 ============
app.use('/api', routes);

// ============ 错误处理 ============
app.use(errorHandler);

export default app;
