import { prisma } from '../server';
import logger from './logger';

interface LogExecutionParams {
  jobSlug: string;
  userId?: string;
  status: 'success' | 'error' | 'skipped';
  result?: string;
  error?: string;
  durationMs?: number;
}

/**
 * 记录定时任务执行日志
 * 同时更新 CronJob 的 lastRunAt / lastStatus / lastResult
 * 日志失败不会中断任务本身
 */
export async function logExecution(params: LogExecutionParams): Promise<void> {
  const { jobSlug, userId, status, result, error, durationMs } = params;

  try {
    await prisma.jobExecutionLog.create({
      data: {
        jobSlug,
        userId: userId ?? null,
        status,
        result: result?.slice(0, 2000) ?? null,
        error: error?.slice(0, 2000) ?? null,
        durationMs: durationMs ?? null,
      },
    });

    // 同步更新 CronJob 模型的最近执行信息
    if (userId) {
      await prisma.cronJob.updateMany({
        where: { userId, jobSlug },
        data: {
          lastRunAt: new Date(),
          lastStatus: status,
          lastResult: result?.slice(0, 500) ?? null,
        },
      });
    }
  } catch (err) {
    // 日志写入失败不应影响任务执行
    logger.error({ jobSlug, err }, 'job-logger 日志写入失败');
  }
}
