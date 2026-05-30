import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// TODO: getAll(userId?) - 获取所有配置
// TODO: getByCategory(category, userId?) - 按类别获取
// TODO: get(category, key, userId?) - 获取单个配置
// TODO: set(category, key, value, encrypted?, userId?) - 设置配置
// TODO: batchSet(settings, userId?) - 批量设置
// TODO: testAiConnection(provider, apiKey, baseUrl) - 测试 AI 连接
// TODO: testSmtpConnection(host, port, user, pass) - 测试邮件连接
