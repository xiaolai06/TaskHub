import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始填充种子数据...');

  // ========== 1. 用户 ==========
  const hashedPassword = await bcrypt.hash('123456', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@taskflow.com',
      password: hashedPassword,
      name: '管理员',
      role: 'ADMIN',
    },
  });

  const user = await prisma.user.create({
    data: {
      email: 'user@taskflow.com',
      password: hashedPassword,
      name: '开发者小王',
      role: 'USER',
    },
  });

  console.log('✅ 用户: 2 条（admin@taskflow.com / user@taskflow.com，密码都是 123456）');

  // ========== 2. 项目 ==========
  const project1 = await prisma.project.create({
    data: {
      name: 'TaskFlow+ 开发',
      description: '智能项目管理系统开发，包含前后端、AI 功能',
      status: 'ACTIVE',
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-08-31'),
      budget: 5000000, // 50000.00 元
      ownerId: admin.id,
    },
  });

  const project2 = await prisma.project.create({
    data: {
      name: '客户管理系统',
      description: 'CRM 系统升级，增加数据分析模块',
      status: 'ACTIVE',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-09-30'),
      budget: 3000000, // 30000.00 元
      ownerId: user.id,
    },
  });

  console.log('✅ 项目: 2 条');

  // ========== 3. 任务 ==========
  const tasks = await Promise.all([
    prisma.task.create({
      data: {
        title: '数据库 Schema 设计',
        description: '设计 16 张表的 Prisma Schema',
        status: 'DONE',
        priority: 'HIGH',
        estimatedHours: 8,
        actualHours: 6,
        startDate: new Date('2026-05-01'),
        dueDate: new Date('2026-05-05'),
        completedAt: new Date('2026-05-04'),
        projectId: project1.id,
        assigneeId: admin.id,
        progress: 100,
      },
    }),
    prisma.task.create({
      data: {
        title: '后端认证模块',
        description: '实现 JWT 登录注册、Session 管理',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        estimatedHours: 12,
        actualHours: 4,
        startDate: new Date('2026-05-10'),
        dueDate: new Date('2026-05-15'),
        projectId: project1.id,
        assigneeId: admin.id,
        progress: 30,
      },
    }),
    prisma.task.create({
      data: {
        title: '前端登录页面',
        description: '用 shadcn/ui 实现精美登录注册页',
        status: 'TODO',
        priority: 'MEDIUM',
        estimatedHours: 6,
        startDate: new Date('2026-05-15'),
        dueDate: new Date('2026-05-18'),
        projectId: project1.id,
        assigneeId: user.id,
      },
    }),
    prisma.task.create({
      data: {
        title: 'AI 对话功能',
        description: '接入 DeepSeek API，实现 Function Calling',
        status: 'TODO',
        priority: 'URGENT',
        estimatedHours: 20,
        dueDate: new Date('2026-05-25'),
        projectId: project1.id,
        assigneeId: admin.id,
      },
    }),
    prisma.task.create({
      data: {
        title: '客户数据迁移',
        description: '从旧系统迁移客户数据到新 CRM',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        estimatedHours: 10,
        actualHours: 3,
        startDate: new Date('2026-06-01'),
        dueDate: new Date('2026-06-10'),
        projectId: project2.id,
        assigneeId: user.id,
        progress: 40,
      },
    }),
    prisma.task.create({
      data: {
        title: '报表导出功能',
        description: '支持 PDF/Excel 导出项目报表',
        status: 'BLOCKED',
        priority: 'LOW',
        estimatedHours: 8,
        dueDate: new Date('2026-07-01'),
        projectId: project2.id,
        assigneeId: user.id,
        progress: 0,
      },
    }),
  ]);

  console.log(`✅ 任务: ${tasks.length} 条`);

  // ========== 4. 成本记录 ==========
  await prisma.costRecord.createMany({
    data: [
      { amount: 500000, category: 'LABOR', description: '前端开发人工', date: new Date('2026-05-01'), projectId: project1.id },
      { amount: 300000, category: 'LABOR', description: '后端开发人工', date: new Date('2026-05-01'), projectId: project1.id },
      { amount: 20000, category: 'MATERIAL', description: '服务器费用', date: new Date('2026-05-05'), projectId: project1.id },
      { amount: 5000, category: 'OVERHEAD', description: 'API 调用费用（DeepSeek）', date: new Date('2026-05-10'), projectId: project1.id },
      { amount: 200000, category: 'LABOR', description: 'CRM 开发人工', date: new Date('2026-06-01'), projectId: project2.id },
    ],
  });

  console.log('✅ 成本记录: 5 条');

  // ========== 5. 客户 ==========
  await prisma.customer.createMany({
    data: [
      { name: '张三', email: 'zhangsan@example.com', phone: '13800138001', company: '阿里巴巴', userId: admin.id },
      { name: '李四', email: 'lisi@example.com', phone: '13800138002', company: '腾讯科技', userId: admin.id },
      { name: '王五', email: 'wangwu@example.com', phone: '13800138003', company: '字节跳动', userId: user.id },
    ],
  });

  console.log('✅ 客户: 3 条');

  // ========== 6. 目标 ==========
  await prisma.goal.createMany({
    data: [
      { userId: admin.id, title: 'Q2 完成 TaskFlow+ 上线', type: 'QUARTERLY', targetValue: 100, currentValue: 35, unit: '%', status: 'ACTIVE', startDate: new Date('2026-04-01'), endDate: new Date('2026-06-30') },
      { userId: user.id, title: '5月完成 CRM 数据迁移', type: 'MONTHLY', targetValue: 100, currentValue: 40, unit: '%', status: 'ACTIVE', startDate: new Date('2026-05-01'), endDate: new Date('2026-05-31') },
    ],
  });

  console.log('✅ 目标: 2 条');

  // ========== 7. 系统配置 ==========
  await prisma.setting.createMany({
    data: [
      { category: 'AI', key: 'provider', value: 'deepseek' },
      { category: 'AI', key: 'model', value: 'deepseek-chat' },
      { category: 'NOTIFY', key: 'email_enabled', value: 'false' },
      { category: 'GENERAL', key: 'company_name', value: 'TaskFlow+ 团队' },
    ],
  });

  console.log('✅ 系统配置: 4 条');

  // ========== 8. 通知 ==========
  await prisma.notification.createMany({
    data: [
      { userId: admin.id, type: 'TASK_DUE', title: '任务即将到期', content: '后端认证模块将于 5月15日 到期，请尽快完成', read: false },
      { userId: admin.id, type: 'SYSTEM', title: '欢迎使用 TaskFlow+', content: '您的账号已创建，开始管理您的项目吧！', read: true },
      { userId: user.id, type: 'PROJECT_CHANGE', title: '项目状态更新', content: 'TaskFlow+ 开发项目已进入开发阶段', read: false },
    ],
  });

  console.log('✅ 通知: 3 条');

  console.log('\n🎉 种子数据填充完成！');
  console.log('📋 测试账号:');
  console.log('   管理员: admin@taskflow.com / 123456');
  console.log('   普通用户: user@taskflow.com / 123456');
}

main()
  .catch((e) => {
    console.error('❌ 种子数据填充失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
