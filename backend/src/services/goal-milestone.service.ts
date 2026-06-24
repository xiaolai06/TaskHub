import { prisma } from '../server';
import { AppError, NotFoundError } from '../utils/errors';
import type {
  CreateMilestoneInput,
  CreateCheckinInput,
} from '../validators/goal.schema';
import { findById } from './goal.service';
import { calculateMilestoneProgress, calculateCheckinProgress } from './goal-progress.service';

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
    where.date = { startsWith: month };
  }

  return prisma.goalCheckin.findMany({
    where,
    orderBy: { date: 'desc' },
  });
}
