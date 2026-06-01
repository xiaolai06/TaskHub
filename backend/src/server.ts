import app from './app';
import { config } from './config';
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

async function main() {
  // 测试数据库连接
  await prisma.$connect();
  console.log('✅ 数据库连接成功');

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
    console.log('⏰ 定时任务已启动');
  } else {
    console.log('⏰ 定时任务已禁用 (CRON_ENABLED=false)');
  }

  // 启动服务器
  app.listen(config.port, () => {
    console.log(`🚀 服务器运行在 http://localhost:${config.port}`);
    console.log(`📡 API 地址: http://localhost:${config.port}/api`);
    console.log(`💚 健康检查: http://localhost:${config.port}/api/health`);
  });
}

main().catch((err) => {
  console.error('❌ 启动失败:', err);
  prisma.$disconnect();
  process.exit(1);
});
