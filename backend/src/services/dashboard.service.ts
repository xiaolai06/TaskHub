import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// TODO: getStats(userId) - 仪表盘统计数据（项目数/任务数/成本/工时）
// TODO: getActivities(userId, limit) - 最近活动
// TODO: getOverdueTasks(userId) - 逾期任务列表
