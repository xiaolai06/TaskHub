import { prisma } from '../server';
import { NotFoundError } from '../utils/errors';
import type {
  CreateGoalInput,
  UpdateGoalInput,
} from '../validators/goal.schema';

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
