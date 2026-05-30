import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// TODO: findAll(filters) - 任务列表（按项目/状态/负责人筛选）
// TODO: findById(id) - 任务详情（含子任务/成本/工时）
// TODO: create(data) - 创建任务
// TODO: update(id, data) - 更新任务
// TODO: delete(id) - 删除任务（级联删除子任务）
// TODO: updateStatus(id, status) - 状态流转
// TODO: getByProject(projectId) - 获取项目下所有任务
