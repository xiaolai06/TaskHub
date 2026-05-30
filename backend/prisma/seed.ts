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
  const customer1 = await prisma.customer.create({
    data: { name: '张三', email: 'zhangsan@example.com', phone: '13800138001', company: '阿里巴巴', industry: '互联网', status: 'VIP', notes: '重要客户，决策人是技术总监李总，对交付质量要求高', userId: admin.id },
  });
  const customer2 = await prisma.customer.create({
    data: { name: '李四', email: 'lisi@example.com', phone: '13800138002', company: '腾讯科技', industry: '互联网', status: 'ACTIVE', notes: '长期合作伙伴，按季度结算', userId: admin.id },
  });
  const customer3 = await prisma.customer.create({
    data: { name: '王五', email: 'wangwu@example.com', phone: '13800138003', company: '字节跳动', industry: '互联网', status: 'LEAD', userId: user.id },
  });

  console.log('✅ 客户: 3 条');

  // ========== 2. 项目 ==========
  const project1 = await prisma.project.create({
    data: {
      name: 'TaskFlow+ 开发',
      description: '智能项目管理系统开发，包含前后端、AI 功能',
      status: 'ACTIVE',
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-08-31'),
      budget: 5000000, // 50000.00 元
      rewardNote: '一次性支付 5 万，上线后付尾款 2 万',
      expenseNote: '外包设计费 1.2 万 + 服务器 3 千',
      type: '开发',
      ownerId: admin.id,
      customerId: customer1.id,
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
      rewardNote: '按月付费 1 万/月，共 3 个月',
      expenseNote: '人工成本为主',
      type: '咨询',
      ownerId: user.id,
      customerId: customer2.id,
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

  // ========== 5. 沟通记录 ==========
  await prisma.communication.createMany({
    data: [
      { userId: admin.id, customerId: customer1.id, projectId: project1.id, type: 'PHONE', content: '确认需求范围和交付时间', summary: '需求确认', nextFollowAt: new Date('2026-06-05') },
      { userId: admin.id, customerId: customer1.id, projectId: project1.id, type: 'MEETING', content: '中期汇报，展示进度', summary: '中期汇报' },
      { userId: admin.id, customerId: customer1.id, type: 'EMAIL', content: '发送报价单', summary: '报价沟通' },
      { userId: admin.id, customerId: customer2.id, projectId: project2.id, type: 'CHAT', content: '讨论数据迁移方案', summary: '方案讨论', nextFollowAt: new Date('2026-06-10') },
      { userId: admin.id, customerId: customer2.id, type: 'PHONE', content: '确认月度付款节点', summary: '付款确认' },
    ],
  });

  console.log('✅ 沟通记录: 5 条');

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
