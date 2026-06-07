import { Router, Request, Response } from 'express';
import { success, error } from '../utils/response';
import { runMorningBriefing } from '../jobs/morning-briefing.job';
import { runWeeklyReport } from '../jobs/weekly-report.job';
import { runFinancePulse } from '../jobs/finance-pulse.job';
import { runClientRadar } from '../jobs/client-radar.job';
import { runHealthCheck } from '../jobs/health-check.job';

const router = Router();

const JOB_MAP: Record<string, { fn: (userId: string) => Promise<string>; label: string }> = {
  'morning-briefing': { fn: runMorningBriefing, label: '晨间简报' },
  'weekly-report': { fn: runWeeklyReport, label: '自动周报' },
  'finance-pulse': { fn: runFinancePulse, label: '订单利润简报' },
  'client-radar': { fn: runClientRadar, label: '客户雷达' },
  'health-check': { fn: runHealthCheck, label: '业务体检' },
};

// POST /api/jobs/:name/run — 手动触发定时任务
router.post('/:name/run', async (req: Request, res: Response) => {
  const name = String(req.params.name);
  const job = JOB_MAP[name];
  if (!job) {
    error(res, 'NOT_FOUND', `未知任务: ${name}。可选: ${Object.keys(JOB_MAP).join(', ')}`, 400);
    return;
  }
  try {
    const result = await job.fn(req.userId!);
    success(res, { name, label: job.label, result }, `${job.label} 执行完成`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '执行失败';
    error(res, 'JOB_FAILED', `${job.label} 执行失败: ${msg}`, 500);
  }
});

// GET /api/jobs — 列出可手动触发的任务
router.get('/', (_req: Request, res: Response) => {
  const jobs = Object.entries(JOB_MAP).map(([name, { label }]) => ({ name, label }));
  success(res, jobs);
});

export default router;
