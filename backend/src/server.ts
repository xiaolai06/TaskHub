import app from './app';
import { config } from './config';
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

async function main() {
  // 测试数据库连接
  await prisma.$connect();
  if (config.nodeEnv !== 'production') {
    console.log('✅ 数据库连接成功');
  }

  // 初始化所有用户的系统预置定时任务
  try {
    const { ensureSystemJobs } = await import('./services/cron-job.service');
    const users = await prisma.user.findMany({ select: { id: true } });
    let totalCreated = 0;
    for (const user of users) {
      const { created } = await ensureSystemJobs(user.id);
      totalCreated += created;
    }
    if (totalCreated > 0) {
      console.log(`📋 已为 ${users.length} 个用户初始化 ${totalCreated} 个系统定时任务`);
    }
  } catch (e) {
    console.warn('初始化系统定时任务失败（可能表还未创建）:', (e as Error).message);
  }

  // 启动定时任务（替代 n8n）
  if (config.cronEnabled) {
    const { startAllCronJobs } = await import('./jobs');
    startAllCronJobs();
    if (config.nodeEnv !== 'production') {
      console.log('⏰ 定时任务已启动');
    }
  }

  // 启动服务器
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`🚀 服务器运行在 http://0.0.0.0:${config.port}`);
    console.log(`📡 API 地址: http://0.0.0.0:${config.port}/api`);
    console.log(`💚 健康检查: http://0.0.0.0:${config.port}/api/health`);
    if (config.nodeEnv === 'production') {
      console.log(`🌐 前端地址: ${config.frontendUrl}`);
    }
  });

  // ============ 优雅关闭 ============
  const shutdown = async (signal: string) => {
    console.log(`\n📦 收到 ${signal}，正在优雅关闭...`);
    server.close(async () => {
      console.log('🔌 HTTP 服务器已关闭');
      await prisma.$disconnect();
      console.log('🗄️ 数据库连接已断开');
      process.exit(0);
    });
    // 超时 10 秒强制退出
    setTimeout(() => {
      console.error('⚠️ 关闭超时，强制退出');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('❌ 启动失败:', err);
  prisma.$disconnect();
  process.exit(1);
});
