import { prisma } from '../server';

export async function getStats(userId: string) {
  const [projectCount, taskStats, recordCostSum, taskCostSum, monthlyIncomeAgg, overdueCount] = await Promise.all([
    prisma.project.count({ where: { ownerId: userId } }),
    prisma.task.groupBy({
      by: ['status'],
      where: { project: { ownerId: userId } },
      _count: { id: true },
    }),
    prisma.costRecord.aggregate({
      where: { project: { ownerId: userId } },
      _sum: { amount: true },
    }),
    prisma.task.aggregate({
      where: { project: { ownerId: userId }, cost: { gt: 0 } },
      _sum: { cost: true },
    }),
    prisma.project.aggregate({
      where: {
        ownerId: userId,
        status: 'COMPLETED',
        updatedAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
      _sum: { budget: true },
    }),
    prisma.task.count({
      where: { project: { ownerId: userId }, dueDate: { lt: new Date() }, status: { not: 'DONE' } },
    }),
  ]);

  const totalTasks = taskStats.reduce((sum, group) => sum + group._count.id, 0);
  const doneTasks = taskStats.find((group) => group.status === 'DONE')?._count.id || 0;
  const totalCost = (recordCostSum._sum.amount || 0) + (taskCostSum._sum.cost || 0);
  const monthlyIncome = monthlyIncomeAgg._sum.budget || 0;

  return {
    projectCount,
    totalTasks,
    doneTasks,
    completionRate: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
    totalCost,
    monthlyIncome,
    estimatedProfit: monthlyIncome - totalCost,
    overdueCount,
  };
}

export async function getRecentTasks(userId: string) {
  return prisma.task.findMany({
    where: { project: { ownerId: userId }, status: { not: 'DONE' } },
    orderBy: [{ dueDate: 'asc' }, { priority: 'asc' }],
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
      budget: true,
      _count: { select: { tasks: true } },
      tasks: { where: { status: 'DONE' }, select: { id: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 6,
  });

  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    status: project.status,
    quote: project.budget ?? 0,
    totalTasks: project._count.tasks,
    doneTasks: project.tasks.length,
  }));
}

export async function getCustomerStats(userId: string) {
  const customers = await prisma.customer.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: 6,
    select: {
      id: true,
      name: true,
      company: true,
      status: true,
      projects: { select: { id: true, budget: true, status: true } },
      communications: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
    },
  });

  return customers.map((customer) => ({
    id: customer.id,
    name: customer.company || customer.name,
    contact: customer.name,
    status: customer.status,
    projects: customer.projects.length,
    quoteTotal: customer.projects.reduce((sum, project) => sum + (project.budget ?? 0), 0),
    completedOrders: customer.projects.filter((project) => project.status === 'COMPLETED').length,
    lastContactAt: customer.communications[0]?.createdAt ?? null,
  }));
}
