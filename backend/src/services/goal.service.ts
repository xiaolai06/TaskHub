import { prisma } from '../server';
import { AppError, NotFoundError } from '../utils/errors';
import type {
  CreateGoalInput,
  UpdateGoalInput,
  UpdateProgressInput,
  CreateProgressLogInput,
  CreateMilestoneInput,
  CreateCheckinInput,
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
    REVENUE: '元', PROFIT: '元',
    NEW_ORDERS: '个', PROJECT_COUNT: '个',
    DELIVERY_RATE: '%',
    TASK_COMPLETION: '个', TASK_RATE: '%', OVERDUE_REDUCTION: '%',
    NEW_CUSTOMERS: '位', CUSTOMER_VISITS: '次', SATISFACTION: '分',
    SKILL_HOURS: '小时', HABIT_STREAK: '天',
    MILESTONE: null,
  };
  return unitMap[metricType] || null;
}

function getProgressModeForMetric(metricType: string): string {
  if (metricType === 'MILESTONE') return 'MILESTONE';
  if (metricType === 'HABIT_STREAK') return 'CHECKIN';
  if (metricType === 'SATISFACTION' || metricType === 'SKILL_HOURS') return 'MANUAL';
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
        checkins: { orderBy: { date: 'desc' }, take: 31 },
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
      checkins: { orderBy: { date: 'desc' } },
      project: { select: { id: true, name: true, status: true } },
      customer: { select: { id: true, name: true, company: true } },
    },
  });
  if (!goal) throw new NotFoundError('目标');
  return goal;
}

export async function create(userId: string, data: CreateGoalInput) {
  const unit = data.unit ?? getUnitForMetric(data.metricType);
  const progressMode = data.progressMode ?? getProgressModeForMetric(data.metricType);
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
      checkins: true,
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
    if (data.unit === undefined) updateData.unit = getUnitForMetric(data.metricType);
    if (data.progressMode === undefined) updateData.progressMode = getProgressModeForMetric(data.metricType);
    if (data.metricType === 'MILESTONE') updateData.targetValue = null;
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
      checkins: true,
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
  const newStatus = data.currentValue >= (goal.targetValue ?? 0) ? 'COMPLETED' : 'ACTIVE';

  return prisma.goal.update({
    where: { id },
    data: { currentValue: data.currentValue, status: newStatus },
    include: {
      milestones: true,
      checkins: true,
      project: { select: { id: true, name: true, status: true } },
      customer: { select: { id: true, name: true, company: true } },
    },
  });
}

// ======================== 自动进度计算 ========================

export async function calculateAutoProgress(userId: string, id: string): Promise<CalculateResult> {
  const goal = await findById(userId, id);

  if (goal.metricType === 'MILESTONE') {
    return calculateMilestoneProgress(goal);
  }

  let currentValue = 0;
  let source = '';
  let sourceCount = 0;

  // 构建项目范围
  let projectIds: string[] = [];
  if (goal.projectId) {
    projectIds = [goal.projectId];
  } else if (goal.customerId) {
    const customerProjects = await prisma.project.findMany({
      where: { customerId: goal.customerId, ownerId: userId },
      select: { id: true },
    });
    projectIds = customerProjects.map(p => p.id);
  }

  const dateFilter = { gte: goal.startDate, lte: goal.endDate };

  switch (goal.metricType) {
    case 'REVENUE': {
      // 收入 = 周期内已完成订单的报价（budget）之和
      const where: Record<string, unknown> = {
        ownerId: userId,
        status: 'COMPLETED',
        updatedAt: dateFilter,
      };
      if (projectIds.length > 0) where.id = { in: projectIds };

      const completed = await prisma.project.findMany({
        where,
        select: { budget: true },
      });
      currentValue = completed.reduce((sum, p) => sum + (p.budget ?? 0), 0) / 100;
      sourceCount = completed.length;
      source = '已完成订单报价';
      break;
    }
    case 'PROFIT': {
      // 利润 = 收入 - 成本
      // 收入
      const incomeWhere: Record<string, unknown> = {
        ownerId: userId,
        status: 'COMPLETED',
        updatedAt: dateFilter,
      };
      if (projectIds.length > 0) incomeWhere.id = { in: projectIds };

      const completed = await prisma.project.findMany({
        where: incomeWhere,
        select: { id: true, budget: true },
      });
      const income = completed.reduce((sum, p) => sum + (p.budget ?? 0), 0);

      // 成本：成本记录 + 任务快捷成本
      const completedIds = completed.map(p => p.id);
      let totalCost = 0;
      if (completedIds.length > 0) {
        const [costAgg, taskCostAgg] = await Promise.all([
          prisma.costRecord.aggregate({
            where: { projectId: { in: completedIds }, date: dateFilter },
            _sum: { amount: true },
          }),
          prisma.task.aggregate({
            where: { projectId: { in: completedIds }, cost: { gt: 0 }, createdAt: dateFilter },
            _sum: { cost: true },
          }),
        ]);
        totalCost = (costAgg._sum.amount ?? 0) + (taskCostAgg._sum.cost ?? 0);
      }

      currentValue = (income - totalCost) / 100;
      sourceCount = completed.length;
      source = '已完成订单利润';
      break;
    }
    case 'NEW_ORDERS': {
      // 新订单 = 周期内新建的项目数
      const where: Record<string, unknown> = {
        ownerId: userId,
        createdAt: dateFilter,
      };
      if (goal.customerId) where.customerId = goal.customerId;

      sourceCount = await prisma.project.count({ where });
      currentValue = sourceCount;
      source = '新建订单';
      break;
    }
    case 'PROJECT_COUNT': {
      const where: Record<string, unknown> = {
        ownerId: userId,
        status: 'COMPLETED',
        updatedAt: dateFilter,
      };
      if (goal.customerId) where.customerId = goal.customerId;

      sourceCount = await prisma.project.count({ where });
      currentValue = sourceCount;
      source = '已完成项目';
      break;
    }
    case 'DELIVERY_RATE': {
      // 交付率 = 按时完成 / 总完成 * 100
      const where: Record<string, unknown> = {
        ownerId: userId,
        status: 'COMPLETED',
        updatedAt: dateFilter,
      };
      if (projectIds.length > 0) where.id = { in: projectIds };

      const allCompleted = await prisma.project.findMany({
        where,
        select: { id: true, endDate: true, updatedAt: true },
      });

      if (allCompleted.length === 0) {
        currentValue = 0;
        sourceCount = 0;
      } else {
        // 按时 = 项目完成时间 <= 项目截止时间（endDate）
        // 如果没有 endDate，则视为按时
        const onTime = allCompleted.filter(p => {
          if (!p.endDate) return true;
          return p.updatedAt <= p.endDate;
        });
        currentValue = Math.round((onTime.length / allCompleted.length) * 100);
        sourceCount = allCompleted.length;
      }
      source = '已完成项目交付';
      break;
    }
    case 'TASK_COMPLETION': {
      const where: Record<string, unknown> = {
        project: { ownerId: userId },
        status: 'DONE',
        completedAt: dateFilter,
      };
      if (projectIds.length > 0) where.projectId = { in: projectIds };
      sourceCount = await prisma.task.count({ where });
      currentValue = sourceCount;
      source = '已完成任务';
      break;
    }
    case 'TASK_RATE': {
      const baseWhere: Record<string, unknown> = {
        project: { ownerId: userId },
        createdAt: dateFilter,
      };
      if (projectIds.length > 0) baseWhere.projectId = { in: projectIds };
      const total = await prisma.task.count({ where: baseWhere });
      const done = await prisma.task.count({ where: { ...baseWhere, status: 'DONE' } });
      currentValue = total > 0 ? Math.round((done / total) * 100) : 0;
      sourceCount = total;
      source = '任务完成率';
      break;
    }
    case 'OVERDUE_REDUCTION': {
      const overdueWhere: Record<string, unknown> = {
        project: { ownerId: userId },
        dueDate: { lt: new Date() },
        status: { not: 'DONE' },
      };
      if (projectIds.length > 0) overdueWhere.projectId = { in: projectIds };
      const totalAllWhere: Record<string, unknown> = {
        project: { ownerId: userId },
        createdAt: dateFilter,
      };
      if (projectIds.length > 0) totalAllWhere.projectId = { in: projectIds };
      const totalAll = await prisma.task.count({ where: totalAllWhere });
      const overdue = await prisma.task.count({ where: overdueWhere });
      currentValue = totalAll > 0 ? Math.round((overdue / totalAll) * 100) : 0;
      sourceCount = totalAll;
      source = '逾期任务占比';
      break;
    }
    case 'NEW_CUSTOMERS': {
      const where: Record<string, unknown> = { userId, createdAt: dateFilter };
      sourceCount = await prisma.customer.count({ where });
      currentValue = sourceCount;
      source = '新增客户';
      break;
    }
    case 'CUSTOMER_VISITS': {
      const where: Record<string, unknown> = { userId, createdAt: dateFilter };
      if (goal.customerId) where.customerId = goal.customerId;
      if (projectIds.length > 0) where.projectId = { in: projectIds };
      sourceCount = await prisma.communication.count({ where });
      currentValue = sourceCount;
      source = '客户回访';
      break;
    }
    case 'SKILL_HOURS': {
      const where: Record<string, unknown> = { userId, date: dateFilter };
      if (projectIds.length > 0) where.projectId = { in: projectIds };
      const agg = await prisma.timeEntry.aggregate({ where, _sum: { hours: true } });
      currentValue = Math.round((agg._sum.hours ?? 0) * 10) / 10;
      sourceCount = await prisma.timeEntry.count({ where });
      source = '学习/工时';
      break;
    }
    case 'HABIT_STREAK': {
      await calculateCheckinProgress(goal);
      const refreshed = await prisma.goal.findUnique({
        where: { id: goal.id },
        include: {
          milestones: true,
          checkins: true,
          project: { select: { id: true, name: true, status: true } },
          customer: { select: { id: true, name: true, company: true } },
        },
      });
      const checkinCount = await prisma.goalCheckin.count({ where: { goalId: goal.id } });
      return {
        goal: refreshed!,
        calculated: refreshed!.currentValue,
        source: '打卡记录',
        sourceCount: checkinCount,
        message: `已打卡 ${checkinCount} 天`,
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

  // 判断状态
  const INVERSE_METRICS = ['OVERDUE_REDUCTION']; // 越低越好的指标
  const isInverse = INVERSE_METRICS.includes(goal.metricType);
  let newStatus: string;

  if (goal.targetValue && (isInverse ? currentValue <= goal.targetValue : currentValue >= goal.targetValue)) {
    newStatus = 'COMPLETED';
  } else {
    const now = new Date();
    const totalDays = Math.max(1, (goal.endDate.getTime() - goal.startDate.getTime()) / 86400000);
    const elapsedDays = Math.max(0, (now.getTime() - goal.startDate.getTime()) / 86400000);
    const expectedProgress = Math.min(100, (elapsedDays / totalDays) * 100);

    let atRisk = false;
    if (isInverse && goal.targetValue) {
      // 反向指标：当前值越高于目标值越危险
      // 容忍度：当前值 > 目标值 * 1.2 才标红
      atRisk = currentValue > goal.targetValue * 1.2 && currentValue > 0;
    } else if (goal.targetValue) {
      const actualProgress = Math.min(100, (currentValue / goal.targetValue) * 100);
      atRisk = actualProgress < expectedProgress * 0.8 && actualProgress < 100;
    }

    newStatus = atRisk ? 'AT_RISK' : 'ACTIVE';
  }

  const updatedGoal = await prisma.goal.update({
    where: { id },
    data: { currentValue, status: newStatus },
    include: {
      milestones: true,
      checkins: true,
      project: { select: { id: true, name: true, status: true } },
      customer: { select: { id: true, name: true, company: true } },
    },
  });

  const message = sourceCount > 0
    ? `从 ${sourceCount} 条${source}中计算出进度：${currentValue}${goal.unit || ''}`
    : `未找到${source}数据，进度为 0`;

  return { goal: updatedGoal, calculated: currentValue, source, sourceCount, message };
}

// ======================== 里程碑进度计算 ========================

async function calculateMilestoneProgress(goal: Awaited<ReturnType<typeof findById>>) {
  const milestones = goal.milestones;
  const totalMilestones = milestones.length;
  const completedMilestones = milestones.filter(m => m.completed).length;
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
      checkins: true,
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

// ======================== 目标总览 ========================

export async function getOverview(userId: string) {
  const now = new Date();

  const goals = await prisma.goal.findMany({
    where: { userId, status: { in: ['ACTIVE', 'AT_RISK'] } },
    include: {
      milestones: { orderBy: { sortOrder: 'asc' } },
      project: { select: { id: true, name: true, status: true } },
      customer: { select: { id: true, name: true, company: true } },
    },
    orderBy: { endDate: 'asc' },
  });

  const goalsWithStatus = goals.map(goal => {
    const totalDays = Math.max(1, (goal.endDate.getTime() - goal.startDate.getTime()) / 86400000);
    const elapsedDays = Math.max(0, (now.getTime() - goal.startDate.getTime()) / 86400000);
    const expectedProgress = Math.min(100, (elapsedDays / totalDays) * 100);

    let actualProgress = 0;
    if (goal.metricType === 'MILESTONE') {
      const total = goal.milestones.length;
      const completed = goal.milestones.filter(m => m.completed).length;
      actualProgress = total > 0 ? Math.round((completed / total) * 100) : 0;
    } else if (goal.targetValue) {
      actualProgress = Math.min(100, (goal.currentValue / goal.targetValue) * 100);
    }

    const daysLeft = Math.max(0, Math.ceil((goal.endDate.getTime() - now.getTime()) / 86400000));
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

// ======================== 获取用户项目/客户列表 ========================

export async function getUserProjects(userId: string) {
  return prisma.project.findMany({
    where: { ownerId: userId },
    select: { id: true, name: true, status: true },
    orderBy: { updatedAt: 'desc' },
  });
}

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

  if (goal.metricType === 'MILESTONE') {
    throw new AppError('里程碑类型目标不支持进度日记，请使用里程碑管理', 400, 'INVALID_OPERATION');
  }

  const log = await prisma.goalProgressLog.create({
    data: {
      goalId,
      userId,
      value: data.value,
      note: data.note,
      date: data.date ? new Date(data.date) : new Date(),
    },
  });

  const newValue = goal.currentValue + data.value;
  const newStatus = goal.targetValue && newValue >= goal.targetValue ? 'COMPLETED' : 'ACTIVE';

  const updatedGoal = await prisma.goal.update({
    where: { id: goalId },
    data: { currentValue: newValue, status: newStatus },
    include: {
      milestones: true,
      checkins: true,
      project: { select: { id: true, name: true, status: true } },
      customer: { select: { id: true, name: true, company: true } },
    },
  });

  return { log, goal: updatedGoal };
}

export async function deleteProgressLog(userId: string, goalId: string, logId: string) {
  await findById(userId, goalId);

  const log = await prisma.goalProgressLog.findFirst({ where: { id: logId, goalId } });
  if (!log) throw new NotFoundError('进度记录');

  await prisma.goalProgressLog.delete({ where: { id: logId } });

  const goal = await prisma.goal.findUnique({ where: { id: goalId } });
  if (!goal) throw new NotFoundError('目标');

  const newValue = Math.max(0, goal.currentValue - log.value);
  const newStatus = goal.targetValue && newValue >= goal.targetValue ? 'COMPLETED' : 'ACTIVE';

  return prisma.goal.update({
    where: { id: goalId },
    data: { currentValue: newValue, status: newStatus },
    include: {
      milestones: true,
      checkins: true,
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

  await calculateMilestoneProgress(goal);
  return milestone;
}

export async function updateMilestone(
  userId: string, goalId: string, milestoneId: string,
  data: { completed?: boolean; title?: string; targetValue?: number },
) {
  const goal = await findById(userId, goalId);

  const milestone = await prisma.goalMilestone.findFirst({ where: { id: milestoneId, goalId } });
  if (!milestone) throw new NotFoundError('里程碑');

  const updatedMilestone = await prisma.goalMilestone.update({
    where: { id: milestoneId },
    data: { ...data, completedAt: data.completed ? new Date() : null },
  });

  await calculateMilestoneProgress(goal);
  return updatedMilestone;
}

export async function deleteMilestone(userId: string, goalId: string, milestoneId: string) {
  const goal = await findById(userId, goalId);

  const milestone = await prisma.goalMilestone.findFirst({ where: { id: milestoneId, goalId } });
  if (!milestone) throw new NotFoundError('里程碑');

  await prisma.goalMilestone.delete({ where: { id: milestoneId } });
  await calculateMilestoneProgress(goal);

  return { deleted: true };
}

// ======================== 打卡管理 ========================

export async function checkin(userId: string, goalId: string, data: CreateCheckinInput) {
  const goal = await findById(userId, goalId);

  if (goal.progressMode !== 'CHECKIN') {
    throw new AppError('该目标不支持打卡，请使用进度日记', 400, 'INVALID_OPERATION');
  }

  const existing = await prisma.goalCheckin.findFirst({ where: { goalId, date: data.date } });
  if (existing) throw new AppError('该日期已打卡', 409, 'ALREADY_CHECKED_IN');

  const record = await prisma.goalCheckin.create({
    data: { goalId, userId, date: data.date, note: data.note },
  });

  // 更新进度
  await calculateCheckinProgress(goal);
  return record;
}

export async function uncheckin(userId: string, goalId: string, date: string) {
  const goal = await findById(userId, goalId);

  const record = await prisma.goalCheckin.findFirst({ where: { goalId, date } });
  if (!record) throw new NotFoundError('打卡记录');

  await prisma.goalCheckin.delete({ where: { id: record.id } });
  await calculateCheckinProgress(goal);
  return { deleted: true };
}

export async function getCheckins(userId: string, goalId: string, month?: string) {
  await findById(userId, goalId);

  const where: Record<string, unknown> = { goalId };
  if (month) {
    // month 格式 "2026-06"，筛选该月所有打卡
    where.date = { startsWith: month };
  }

  return prisma.goalCheckin.findMany({
    where,
    orderBy: { date: 'desc' },
  });
}

async function calculateCheckinProgress(goal: Awaited<ReturnType<typeof prisma.goal.findFirst>>) {
  if (!goal) return;

  const checkins = await prisma.goalCheckin.findMany({
    where: { goalId: goal.id },
    orderBy: { date: 'asc' },
  });

  const totalDays = checkins.length;

  // 计算连续天数（从最近一天往前数）
  let streak = 0;
  if (checkins.length > 0) {
    const today = new Date().toISOString().split('T')[0];
    const dates = checkins.map(c => c.date).sort().reverse();
    let expected = today;
    for (const d of dates) {
      if (d === expected || d === getYesterday(expected)) {
        if (d === expected) { streak++; expected = getYesterday(d); }
        else if (d === getYesterday(expected) && streak === 0) { streak++; expected = getYesterday(d); }
        else break;
      } else break;
    }
  }

  // 进度 = 打卡天数（targetValue 为期望打卡天数）
  const currentValue = totalDays;
  const newStatus = goal.targetValue && totalDays >= goal.targetValue ? 'COMPLETED' : 'ACTIVE';

  await prisma.goal.update({
    where: { id: goal.id },
    data: { currentValue, status: newStatus },
  });
}

function getYesterday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}
