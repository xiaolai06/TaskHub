import { prisma } from '../server';

export async function getTodayEntries(userId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return prisma.timeEntry.findMany({
    where: { userId, date: { gte: today } },
    include: {
      task: { select: { id: true, title: true } },
      project: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getTodayTodo(userId: string) {
  return prisma.todayTodo.findMany({
    where: { userId },
    orderBy: [{ completed: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function addTodo(userId: string, content: string) {
  return prisma.todayTodo.create({ data: { userId, content } });
}

export async function toggleTodo(userId: string, id: string) {
  const todo = await prisma.todayTodo.findFirst({ where: { id, userId } });
  if (!todo) return null;
  return prisma.todayTodo.update({
    where: { id },
    data: { completed: !todo.completed },
  });
}

export async function removeTodo(userId: string, id: string) {
  await prisma.todayTodo.deleteMany({ where: { id, userId } });
  return { deleted: true };
}

export async function startTimer(userId: string, data: { description?: string; taskId?: string; projectId?: string }) {
  // 先结束所有未完成的计时器
  await prisma.workTimer.updateMany({
    where: { userId, endedAt: null },
    data: { endedAt: new Date() },
  });
  return prisma.workTimer.create({
    data: {
      userId,
      description: data.description,
      taskId: data.taskId,
      projectId: data.projectId,
      startedAt: new Date(),
    },
  });
}

export async function pauseTimer(userId: string, id: string) {
  const timer = await prisma.workTimer.findFirst({ where: { id, userId } });
  if (!timer || timer.endedAt) return null;
  const elapsed = (new Date().getTime() - timer.startedAt.getTime()) / 60000;
  return prisma.workTimer.update({
    where: { id },
    data: { endedAt: new Date(), totalMinutes: timer.totalMinutes + elapsed },
  });
}

export async function resumeTimer(userId: string, id: string) {
  const timer = await prisma.workTimer.findFirst({ where: { id, userId } });
  if (!timer) return null;
  return prisma.workTimer.update({
    where: { id },
    data: { startedAt: new Date(), endedAt: null },
  });
}

export async function stopTimer(userId: string, id: string) {
  const timer = await prisma.workTimer.findFirst({ where: { id, userId } });
  if (!timer) return null;
  const elapsed = timer.endedAt ? 0 : (new Date().getTime() - timer.startedAt.getTime()) / 60000;
  // 只有有说明的计时才写入 TimeEntry
  if (timer.description) {
    await prisma.timeEntry.create({
      data: {
        userId,
        taskId: timer.taskId,
        projectId: timer.projectId,
        hours: Math.round((timer.totalMinutes + elapsed) / 6) / 10,
        description: timer.description,
        date: new Date(),
      },
    });
  }
  return prisma.workTimer.update({
    where: { id },
    data: { endedAt: new Date(), totalMinutes: timer.totalMinutes + elapsed, active: false },
  });
}

export async function getActiveTimer(userId: string) {
  return prisma.workTimer.findMany({
    where: { userId, endedAt: null, active: true },
  });
}
