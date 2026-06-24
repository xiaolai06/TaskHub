import app from './app';
import { config } from './config';
import { PrismaClient } from '@prisma/client';
import logger from './utils/logger';

export const prisma = new PrismaClient();

// ============ 全局错误处理 ============
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ err: reason }, 'Unhandled Rejection');
  // 不退出进程，让 PM2 管理重启
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught Exception');
  process.exit(1);
});

async function main() {
  // 测试数据库连接
  await prisma.$connect();

  // SQLite 生产优化：WAL 模式 + 忙等超时
  // Prisma 6 中 PRAGMA 可能返回结果，$executeRawUnsafe 不允许，改用 $queryRawUnsafe
  if (config.databaseUrl.includes('file:')) {
    try {
      await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL');
      await prisma.$queryRawUnsafe('PRAGMA busy_timeout=5000');
      if (config.nodeEnv !== 'production') {
        logger.info('SQLite WAL 模式已启用');
      }
    } catch (e) {
      logger.warn({ err: e }, 'SQLite PRAGMA 设置失败');
    }
  }

  if (config.nodeEnv !== 'production') {
    logger.info('数据库连接成功');
  }

  // 初始化所有用户的系统预置定时任务
  let stopAllCronJobs: (() => void) | undefined;
  try {
    const { ensureSystemJobs } = await import('./services/cron-job.service');
    const users = await prisma.user.findMany({ select: { id: true } });
    let totalCreated = 0;
    for (const user of users) {
      const { created } = await ensureSystemJobs(user.id);
      totalCreated += created;
    }
    if (totalCreated > 0) {
      logger.info({ userCount: users.length, created: totalCreated }, '已初始化系统定时任务');
    }
  } catch (e) {
    logger.warn({ err: e }, '初始化系统定时任务失败（可能表还未创建）');
  }

  // 启动定时任务（替代 n8n）
  if (config.cronEnabled) {
    const cronModule = await import('./jobs');
    cronModule.startAllCronJobs();
    stopAllCronJobs = cronModule.stopAllCronJobs;
    if (config.nodeEnv !== 'production') {
      logger.info('定时任务已启动');
    }
  }

  // 启动服务器
  const server = app.listen(config.port, '0.0.0.0', () => {
    logger.info({ port: config.port }, '服务器运行在 http://0.0.0.0');
    logger.info({ port: config.port }, 'API 地址: /api');
    logger.info({ port: config.port }, '健康检查: /api/health');
    if (config.nodeEnv === 'production') {
      logger.info({ frontendUrl: config.frontendUrl }, '前端地址');
    }
  });

  // 请求超时保护（AI 流式端点自行管理更长超时）
  server.timeout = 60000;
  server.keepAliveTimeout = 65000;

  // ============ 优雅关闭 ============
  const shutdown = async (signal: string) => {
    logger.info({ signal }, '收到信号，正在优雅关闭');

    // 先停止定时任务，避免在 DB 断连后继续执行
    if (stopAllCronJobs) {
      stopAllCronJobs();
      logger.info('定时任务已停止');
    }

    server.close(async () => {
      logger.info('HTTP 服务器已关闭');
      await prisma.$disconnect();
      logger.info('数据库连接已断开');
      process.exit(0);
    });
    // 超时 10 秒强制退出
    setTimeout(() => {
      logger.fatal('关闭超时，强制退出');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, '启动失败');
  prisma.$disconnect();
  process.exit(1);
});
