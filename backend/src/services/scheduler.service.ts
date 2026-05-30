import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// TODO: getSchedule(projectId) - 项目排期视图
// TODO: suggestSchedule(projectId) - AI 排期建议
// TODO: reschedule(projectId, options) - 重新排期
// TODO: detectConflicts(projectId) - 检测排期冲突
