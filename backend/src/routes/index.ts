import { Router, Request, Response } from 'express';
import { success } from '../utils/response';

const router = Router();

// 健康检查
router.get('/health', (_req: Request, res: Response) => {
  success(res, { status: 'ok', timestamp: new Date().toISOString() }, '服务运行正常');
});

// 后续模块路由在此注册
// router.use('/auth', authRoutes);
// router.use('/projects', projectRoutes);
// router.use('/tasks', taskRoutes);
// ...

export default router;
