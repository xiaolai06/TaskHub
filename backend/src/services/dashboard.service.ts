import { prisma } from '../server';

export async function getStats(userId: string) {
  const [projectCount, taskStats, costSum, overdueCount] = await Promise.all([
    // 项目总数
    prisma.project.count({ where: { ownerId: userId } }),

    // 任务统计
    prisma.task.groupBy({
      by: ['status'],
      where: { project: { ownerId: userId } },
      _count: { id: true },
    }),

    // 总成本（分）
    prisma.costRecord.aggregate({
      where: { project: { ownerId: userId } },
      _sum: { amount: true },
    }),

    // 逾期任务数
    prisma.task.count({
      where: {
        project: { ownerId: userId },
        dueDate: { lt: new Date() },
        status: { not: 'DONE' },
      },
    }),
  ]);

  const totalTasks = taskStats.reduce((sum, g) => sum + g._count.id, 0);
  const doneTasks = taskStats.find((g) => g.status === 'DONE')?._count.id || 0;

  return {
    projectCount,
    totalTasks,
    doneTasks,
    completionRate: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
    totalCost: costSum._sum.amount || 0,
    overdueCount,
  };
}

export async function getRecentTasks(userId: string, limit = 5) {
  return prisma.task.findMany({
    where: { project: { ownerId: userId } },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      updatedAt: true,
      project: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
    },
  });
}

export async function getProjectStats(userId: string) {
  const projects = await prisma.project.findMany({
    where: { ownerId: userId },
    select: {
      id: true,
      name: true,
      status: true,
      _count: { select: { tasks: true } },
      tasks: {
        where: { status: 'DONE' },
        select: { id: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 6,
  });

  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    totalTasks: p._count.tasks,
    doneTasks: p.tasks.length,
  }));
}
