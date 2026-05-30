import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// TODO: findAll(userId, filters) - 项目列表（分页/筛选/排序）
// TODO: findById(id) - 项目详情（含任务/成本/负责人）
// TODO: create(data) - 创建项目
// TODO: update(id, data) - 更新项目
// TODO: delete(id) - 删除项目（级联删除任务/成本/工时/沟通记录）
