import { prisma } from '../server';
import { AppError, NotFoundError } from '../utils/errors';
import type {
  UpdateProgressInput,
  CreateProgressLogInput,
} from '../validators/goal.schema';
import { findById } from './goal.service';

// ======================== 类型定义 ========================

interface CalculateResult {
  goal: Awaited<ReturnType<typeof findById>>;
  calculated: number;
  source: string;
  sourceCount: number;
  message: string;
}

// ======================== 手动进度更新 ========================

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
  const INVERSE_METRICS = ['OVERDUE_REDUCTION'];
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

export async function calculateMilestoneProgress(goal: Awaited<ReturnType<typeof findById>>) {
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

// ======================== 打卡进度计算 ========================

export async function calculateCheckinProgress(goal: Awaited<ReturnType<typeof prisma.goal.findFirst>>) {
  if (!goal) return;

  const checkins = await prisma.goalCheckin.findMany({
    where: { goalId: goal.id },
    orderBy: { date: 'asc' },
  });

  const totalDays = checkins.length;

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
