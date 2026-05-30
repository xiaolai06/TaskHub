import { Router, Request, Response } from 'express';
import { success } from '../utils/response';

// 导入各模块路由
import authRoutes from './auth.routes';
import projectRoutes from './project.routes';
import taskRoutes from './task.routes';
import costRoutes from './cost.routes';
import customerRoutes from './customer.routes';
import goalRoutes from './goal.routes';
import schedulerRoutes from './scheduler.routes';
import dashboardRoutes from './dashboard.routes';
import reportRoutes from './report.routes';
import searchRoutes from './search.routes';
import researchRoutes from './research.routes';
import llmRoutes from './llm.routes';
import notificationRoutes from './notification.routes';
import settingRoutes from './setting.routes';
import webhookRoutes from './webhook.routes';

// 导入认证中间件（需要登录才能访问的接口加这个）
import { auth } from '../middleware/auth';

const router = Router();

// ============ 公开接口（不需要登录） ============
router.get('/health', (_req: Request, res: Response) => {
  success(res, { status: 'ok', timestamp: new Date().toISOString() }, '服务运行正常');
});

router.use('/auth', authRoutes);          // /api/auth/*（登录/注册是公开的）
router.use('/webhooks', webhookRoutes);   // /api/webhooks/*（n8n 回调是公开的）

// ============ 需要登录的接口 ============
router.use('/projects', auth, projectRoutes);      // /api/projects/*
router.use('/tasks', auth, taskRoutes);             // /api/tasks/*
router.use('/costs', auth, costRoutes);             // /api/costs/*
router.use('/customers', auth, customerRoutes);     // /api/customers/*
router.use('/goals', auth, goalRoutes);             // /api/goals/*
router.use('/scheduler', auth, schedulerRoutes);    // /api/scheduler/*
router.use('/dashboard', auth, dashboardRoutes);    // /api/dashboard/*
router.use('/reports', auth, reportRoutes);         // /api/reports/*
router.use('/search', auth, searchRoutes);          // /api/search/*
router.use('/research', auth, researchRoutes);      // /api/research/*
router.use('/llm', auth, llmRoutes);                // /api/llm/*
router.use('/notifications', auth, notificationRoutes);  // /api/notifications/*
router.use('/settings', auth, settingRoutes);       // /api/settings/*

export default router;
