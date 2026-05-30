import app from './app';
import { config } from './config';
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

async function main() {
  // 测试数据库连接
  await prisma.$connect();
  console.log('✅ 数据库连接成功');

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
