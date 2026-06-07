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
import greetingRoutes from './greeting.routes';
import profileRoutes from './profile.routes';
import preferenceRoutes from './preference.routes';
import cronJobRoutes from './cron-job.routes';
import jobRoutes from './job.routes';
import workRoutes from './work.routes';

// 导入认证中间件（需要登录才能访问的接口加这个）
import { auth } from '../middleware/auth';
import { apiLimit } from '../middleware/rateLimit';

const router = Router();

// ============ 公开接口（不需要登录） ============
router.get('/health', (_req: Request, res: Response) => {
  success(res, { status: 'ok', timestamp: new Date().toISOString() }, '服务运行正常');
});

router.use('/auth', authRoutes);          // /api/auth/*（登录/注册是公开的）
router.use('/webhooks', webhookRoutes);   // /api/webhooks/*（n8n 回调是公开的）

// ============ 需要登录的接口（含限频保护） ============
router.use('/projects', auth, apiLimit, projectRoutes);      // /api/projects/*
router.use('/tasks', auth, apiLimit, taskRoutes);             // /api/tasks/*
router.use('/costs', auth, apiLimit, costRoutes);             // /api/costs/*
router.use('/customers', auth, apiLimit, customerRoutes);     // /api/customers/*
router.use('/goals', auth, apiLimit, goalRoutes);             // /api/goals/*
router.use('/scheduler', auth, apiLimit, schedulerRoutes);    // /api/scheduler/*
router.use('/dashboard', auth, apiLimit, dashboardRoutes);    // /api/dashboard/*
router.use('/reports', auth, apiLimit, reportRoutes);         // /api/reports/*
router.use('/search', auth, apiLimit, searchRoutes);          // /api/search/*
router.use('/research', auth, apiLimit, researchRoutes);      // /api/research/*
router.use('/llm', auth, apiLimit, llmRoutes);                // /api/llm/*
router.use('/notifications', auth, apiLimit, notificationRoutes);  // /api/notifications/*
router.use('/settings', auth, apiLimit, settingRoutes);       // /api/settings/*
router.use('/greetings', auth, apiLimit, greetingRoutes);    // /api/greetings/*
router.use('/profile', auth, apiLimit, profileRoutes);      // /api/profile/*
router.use('/preferences', auth, apiLimit, preferenceRoutes); // /api/preferences/*
router.use('/cron-jobs', auth, apiLimit, cronJobRoutes);      // /api/cron-jobs/*
router.use('/jobs', auth, apiLimit, jobRoutes);              // /api/jobs/*（手动触发）
router.use('/work', auth, apiLimit, workRoutes);            // /api/work/*

export default router;
