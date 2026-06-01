import { prisma } from '../server';
import { AppError, NotFoundError } from '../utils/errors';
import type {
  CreateGoalInput,
  UpdateGoalInput,
  UpdateProgressInput,
  CreateProgressLogInput,
  CreateMilestoneInput,
} from '../validators/goal.schema';

// ======================== 类型定义 ========================

interface CalculateResult {
  goal: Awaited<ReturnType<typeof findById>>;
  calculated: number;
  source: string;
  sourceCount: number;
  message: string;
}

// ======================== 工具函数 ========================

function getUnitForMetric(metricType: string): string | null {
  const unitMap: Record<string, string | null> = {
    REVENUE: '元',
    PROJECT_COUNT: '个',
    CLIENT_COUNT: '个',
    HOURS: '小时',
    PERCENTAGE: '%',
    MILESTONE: null,
  };
  return unitMap[metricType] || null;
}

function getProgressModeForMetric(metricType: string): string {
  if (metricType === 'MILESTONE') return 'MILESTONE';
  return 'AUTO';
}

// ======================== 目标 CRUD ========================

export async function findAll(userId: string, filters?: {
  page?: number; limit?: number; status?: string; type?: string;
}) {
  const { page = 1, limit = 20, status, type } = filters || {};
  const where: Record<string, unknown> = { userId };
  if (status) where.status = status;
  if (type) where.type = type;

  const [data, total] = await Promise.all([
    prisma.goal.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        milestones: { orderBy: { sortOrder: 'asc' } },
        project: { select: { id: true, name: true, status: true } },
        customer: { select: { id: true, name: true, company: true } },
      },
    }),
    prisma.goal.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function findById(userId: string, id: string) {
  const goal = await prisma.goal.findFirst({
    where: { id, userId },
    include: {
      milestones: { orderBy: { sortOrder: 'asc' } },
      project: { select: { id: true, name: true, status: true } },
      customer: { select: { id: true, name: true, company: true } },
    },
  });
  if (!goal) throw new NotFoundError('目标');
  return goal;
}

export async function create(userId: string, data: CreateGoalInput) {
  // 根据 metricType 自动设置 unit 和 progressMode
  const unit = data.unit ?? getUnitForMetric(data.metricType);
  const progressMode = data.progressMode ?? getProgressModeForMetric(data.metricType);

  // MILESTONE 类型不需要 targetValue
  const targetValue = data.metricType === 'MILESTONE' ? null : data.targetValue;

  return prisma.goal.create({
    data: {
      title: data.title,
      description: data.description,
      type: data.type,
      metricType: data.metricType,
      targetValue,
      unit: unit || null,
      progressMode,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      projectId: data.projectId || null,
      customerId: data.customerId || null,
      userId,
    },
    include: {
      milestones: true,
      project: { select: { id: true, name: true, status: true } },
      customer: { select: { id: true, name: true, company: true } },
    },
  });
}

export async function update(userId: string, id: string, data: UpdateGoalInput) {
  await findById(userId, id);

  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.metricType !== undefined) {
    updateData.metricType = data.metricType;
    // 如果 unit 没有显式设置，根据 metricType 自动设置
    if (data.unit === undefined) {
      updateData.unit = getUnitForMetric(data.metricType);
    }
    // 如果 progressMode 没有显式设置，根据 metricType 自动设置
    if (data.progressMode === undefined) {
      updateData.progressMode = getProgressModeForMetric(data.metricType);
    }
    // MILESTONE 类型不需要 targetValue
    if (data.metricType === 'MILESTONE') {
      updateData.targetValue = null;
    }
  }
  if (data.targetValue !== undefined) updateData.targetValue = data.targetValue;
  if (data.unit !== undefined) updateData.unit = data.unit;
  if (data.progressMode !== undefined) updateData.progressMode = data.progressMode;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
  if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
  if (data.projectId !== undefined) updateData.projectId = data.projectId || null;
  if (data.customerId !== undefined) updateData.customerId = data.customerId || null;
  if (data.reviewNote !== undefined) updateData.reviewNote = data.reviewNote;
  if (data.nextAction !== undefined) updateData.nextAction = data.nextAction;

  return prisma.goal.update({
    where: { id },
    data: updateData,
    include: {
      milestones: true,
      project: { select: { id: true, name: true, status: true } },
      customer: { select: { id: true, name: true, company: true } },
    },
  });
}

export async function remove(userId: string, id: string) {
  await findById(userId, id);
  return prisma.goal.delete({ where: { id } });
}

// ======================== 进度管理 ========================

export async function updateProgress(userId: string, id: string, data: UpdateProgressInput) {
  const goal = await findById(userId, id);

  const newStatus = data.currentValue >= (goal.targetValue ?? 0)
    ? 'COMPLETED'
    : 'ACTIVE';

  return prisma.goal.update({
    where: { id },
    data: {
      currentValue: data.currentValue,
      status: newStatus,
    },
    include: {
      milestones: true,
      project: { select: { id: true, name: true, status: true } },
      customer: { select: { id: true, name: true, company: true } },
    },
  });
}

// ======================== 自动进度计算 ========================

export async function calculateAutoProgress(userId: string, id: string): Promise<CalculateResult> {
  const goal = await findById(userId, id);

  // MILESTONE 类型使用里程碑计算
  if (goal.metricType === 'MILESTONE') {
    return calculateMilestoneProgress(goal);
  }

  let currentValue = 0;
  let source = '';
  let sourceCount = 0;

  // 构建项目 ID 过滤条件
  let projectIds: string[] = [];

  if (goal.projectId) {
    // 关联了单个项目
    projectIds = [goal.projectId];
  } else if (goal.customerId) {
    // 关联了客户，查找该客户下所有项目
    const customerProjects = await prisma.project.findMany({
      where: { customerId: goal.customerId, ownerId: userId },
      select: { id: true },
    });
    projectIds = customerProjects.map(p => p.id);
  }

  switch (goal.metricType) {
    case 'REVENUE': {
      const whereClause: Record<string, unknown> = {
        createdAt: { gte: goal.startDate, lte: goal.endDate },
      };

      if (projectIds.length > 0) {
        whereClause.projectId = { in: projectIds };
      } else {
        whereClause.project = { ownerId: userId };
      }

      const costAgg = await prisma.costRecord.aggregate({
        where: whereClause,
        _sum: { amount: true },
      });
      sourceCount = await prisma.costRecord.count({ where: whereClause });
      currentValue = (costAgg._sum.amount ?? 0) / 100;
      source = '项目成本记录';
      break;
    }
    case 'PROJECT_COUNT': {
      const whereClause: Record<string, unknown> = {
        ownerId: userId,
        status: 'COMPLETED',
        createdAt: { gte: goal.startDate, lte: goal.endDate },
      };

      if (goal.customerId) {
        whereClause.customerId = goal.customerId;
      }

      sourceCount = await prisma.project.count({ where: whereClause });
      currentValue = sourceCount;
      source = '已完成项目';
      break;
    }
    case 'CLIENT_COUNT': {
      const whereClause = {
        userId,
        createdAt: { gte: goal.startDate, lte: goal.endDate },
      };

      sourceCount = await prisma.customer.count({ where: whereClause });
      currentValue = sourceCount;
      source = '新建客户';
      break;
    }
    case 'HOURS': {
      const whereClause: Record<string, unknown> = {
        userId,
        date: { gte: goal.startDate, lte: goal.endDate },
      };

      if (projectIds.length > 0) {
        whereClause.projectId = { in: projectIds };
      }

      const timeAgg = await prisma.timeEntry.aggregate({
        where: whereClause,
        _sum: { hours: true },
      });
      sourceCount = await prisma.timeEntry.count({ where: whereClause });
      currentValue = timeAgg._sum.hours ?? 0;
      source = '工时记录';
      break;
    }
    case 'PERCENTAGE': {
      // 百分比类型不支持自动计算
      return {
        goal,
        calculated: goal.currentValue,
        source: '手动录入',
        sourceCount: 0,
        message: '百分比目标不支持自动计算，请手动更新进度',
      };
    }
    default: {
      return {
        goal,
        calculated: goal.currentValue,
        source: '手动录入',
        sourceCount: 0,
        message: '该目标类型不支持自动计算，请手动更新进度',
      };
    }
  }

  const newStatus = goal.targetValue && currentValue >= goal.targetValue
    ? 'COMPLETED'
    : 'ACTIVE';

  const updatedGoal = await prisma.goal.update({
    where: { id },
    data: { currentValue, status: newStatus },
    include: {
      milestones: true,
      project: { select: { id: true, name: true, status: true } },
      customer: { select: { id: true, name: true, company: true } },
    },
  });

  const message = sourceCount > 0
    ? `从 ${sourceCount} 条${source}中计算出进度：${currentValue}${goal.unit || ''}`
    : `未找到${source}数据，进度为 0`;

  return {
    goal: updatedGoal,
    calculated: currentValue,
    source,
    sourceCount,
    message,
  };
}

// ======================== 里程碑进度计算 ========================

async function calculateMilestoneProgress(goal: Awaited<ReturnType<typeof findById>>) {
  const milestones = goal.milestones;
  const totalMilestones = milestones.length;
  const completedMilestones = milestones.filter(m => m.completed).length;

  // 里程碑进度用百分比表示
  const currentValue = totalMilestones > 0
    ? Math.round((completedMilestones / totalMilestones) * 100)
    : 0;

  const newStatus = totalMilestones > 0 && completedMilestones >= totalMilestones
    ? 'COMPLETED'
    : 'ACTIVE';

  const updatedGoal = await prisma.goal.update({
    where: { id: goal.id },
    data: { currentValue, status: newStatus },
    include: {
      milestones: true,
      project: { select: { id: true, name: true, status: true } },
      customer: { select: { id: true, name: true, company: true } },
    },
  });

  return {
    goal: updatedGoal,
    calculated: currentValue,
    source: '里程碑',
    sourceCount: totalMilestones,
    message: totalMilestones > 0
      ? `已完成 ${completedMilestones}/${totalMilestones} 个里程碑，进度 ${currentValue}%`
      : '暂无里程碑，请先添加里程碑',
  };
}

// ======================== 目标总览（看板数据） ========================

export async function getOverview(userId: string) {
  const now = new Date();

  const goals = await prisma.goal.findMany({
    where: {
      userId,
      status: { in: ['ACTIVE', 'AT_RISK'] },
    },
    include: {
      milestones: { orderBy: { sortOrder: 'asc' } },
      project: { select: { id: true, name: true, status: true } },
      customer: { select: { id: true, name: true, company: true } },
    },
    orderBy: { endDate: 'asc' },
  });

  const goalsWithStatus = goals.map(goal => {
    const totalDays = Math.max(1, (goal.endDate.getTime() - goal.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.max(0, (now.getTime() - goal.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const expectedProgress = Math.min(100, (elapsedDays / totalDays) * 100);

    // 里程碑类型用里程碑数计算进度
    let actualProgress = 0;
    if (goal.metricType === 'MILESTONE') {
      const total = goal.milestones.length;
      const completed = goal.milestones.filter(m => m.completed).length;
      actualProgress = total > 0 ? Math.round((completed / total) * 100) : 0;
    } else if (goal.targetValue) {
      actualProgress = Math.min(100, (goal.currentValue / goal.targetValue) * 100);
    }

    const daysLeft = Math.max(0, Math.ceil((goal.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const isAtRisk = actualProgress < expectedProgress * 0.8 && actualProgress < 100;

    return {
      ...goal,
      expectedProgress: Math.round(expectedProgress),
      actualProgress: Math.round(actualProgress),
      daysLeft,
      isAtRisk,
    };
  });

  return {
    goals: goalsWithStatus,
    summary: {
      total: goalsWithStatus.length,
      onTrack: goalsWithStatus.filter(g => !g.isAtRisk).length,
      atRisk: goalsWithStatus.filter(g => g.isAtRisk).length,
    },
  };
}

// ======================== 获取用户项目列表 ========================

export async function getUserProjects(userId: string) {
  return prisma.project.findMany({
    where: { ownerId: userId },
    select: { id: true, name: true, status: true },
    orderBy: { updatedAt: 'desc' },
  });
}

// ======================== 获取用户客户列表 ========================

export async function getUserCustomers(userId: string) {
  return prisma.customer.findMany({
    where: { userId },
    select: { id: true, name: true, company: true },
    orderBy: { updatedAt: 'desc' },
  });
}

// ======================== 进度日记管理 ========================

export async function getProgressLogs(userId: string, goalId: string) {
  await findById(userId, goalId);
  return prisma.goalProgressLog.findMany({
    where: { goalId },
    orderBy: { date: 'desc' },
  });
}

export async function addProgressLog(userId: string, goalId: string, data: CreateProgressLogInput) {
  const goal = await findById(userId, goalId);

  // MILESTONE 类型不支持进度日记
  if (goal.metricType === 'MILESTONE') {
    throw new AppError('里程碑类型目标不支持进度日记，请使用里程碑管理', 400, 'INVALID_OPERATION');
  }

  // 创建进度日记
  const log = await prisma.goalProgressLog.create({
    data: {
      goalId,
      userId,
      value: data.value,
      note: data.note,
      date: data.date ? new Date(data.date) : new Date(),
    },
  });

  // 更新目标当前进度（累加）
  const newValue = goal.currentValue + data.value;
  const newStatus = goal.targetValue && newValue >= goal.targetValue ? 'COMPLETED' : 'ACTIVE';

  const updatedGoal = await prisma.goal.update({
    where: { id: goalId },
    data: { currentValue: newValue, status: newStatus },
    include: {
      milestones: true,
      project: { select: { id: true, name: true, status: true } },
      customer: { select: { id: true, name: true, company: true } },
    },
  });

  return { log, goal: updatedGoal };
}

export async function deleteProgressLog(userId: string, goalId: string, logId: string) {
  await findById(userId, goalId);

  const log = await prisma.goalProgressLog.findFirst({
    where: { id: logId, goalId },
  });
  if (!log) throw new NotFoundError('进度记录');

  // 删除日记并回退进度
  await prisma.goalProgressLog.delete({ where: { id: logId } });

  const goal = await prisma.goal.findUnique({ where: { id: goalId } });
  if (!goal) throw new NotFoundError('目标');

  const newValue = Math.max(0, goal.currentValue - log.value);
  const newStatus = goal.targetValue && newValue >= goal.targetValue
    ? 'COMPLETED'
    : 'ACTIVE';

  return prisma.goal.update({
    where: { id: goalId },
    data: { currentValue: newValue, status: newStatus },
    include: {
      milestones: true,
      project: { select: { id: true, name: true, status: true } },
      customer: { select: { id: true, name: true, company: true } },
    },
  });
}

// ======================== 里程碑管理 ========================

export async function getMilestones(userId: string, goalId: string) {
  await findById(userId, goalId);
  return prisma.goalMilestone.findMany({
    where: { goalId },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function createMilestone(userId: string, goalId: string, data: CreateMilestoneInput) {
  const goal = await findById(userId, goalId);

  // 只有 MILESTONE 类型才应该创建里程碑
  if (goal.metricType !== 'MILESTONE') {
    throw new AppError('只有里程碑类型的目标才能添加里程碑', 400, 'INVALID_OPERATION');
  }

  const milestone = await prisma.goalMilestone.create({
    data: {
      title: data.title,
      targetValue: data.targetValue ?? 0,
      sortOrder: data.sortOrder ?? 0,
      goalId,
    },
  });

  // 创建里程碑后自动重新计算进度
  await calculateMilestoneProgress(goal);

  return milestone;
}

export async function updateMilestone(
  userId: string,
  goalId: string,
  milestoneId: string,
  data: { completed?: boolean; title?: string; targetValue?: number },
) {
  const goal = await findById(userId, goalId);

  const milestone = await prisma.goalMilestone.findFirst({
    where: { id: milestoneId, goalId },
  });
  if (!milestone) throw new NotFoundError('里程碑');

  const updatedMilestone = await prisma.goalMilestone.update({
    where: { id: milestoneId },
    data: {
      ...data,
      completedAt: data.completed ? new Date() : null,
    },
  });

  // 更新里程碑后自动重新计算进度
  await calculateMilestoneProgress(goal);

  return updatedMilestone;
}

export async function deleteMilestone(userId: string, goalId: string, milestoneId: string) {
  const goal = await findById(userId, goalId);

  const milestone = await prisma.goalMilestone.findFirst({
    where: { id: milestoneId, goalId },
  });
  if (!milestone) throw new NotFoundError('里程碑');

  await prisma.goalMilestone.delete({ where: { id: milestoneId } });

  // 删除里程碑后自动重新计算进度
  await calculateMilestoneProgress(goal);

  return { deleted: true };
}
