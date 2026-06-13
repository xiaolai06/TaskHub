import { prisma } from '../server';
import { getFinancialSummary } from './finance.service';

export async function getStats(userId: string) {
  const [projectCount, taskStats, overdueCount, finance] = await Promise.all([
    prisma.project.count({ where: { ownerId: userId } }),
    prisma.task.groupBy({
      by: ['status'],
      where: { project: { ownerId: userId } },
      _count: { id: true },
    }),
    prisma.task.count({
      where: { project: { ownerId: userId }, dueDate: { lt: new Date() }, status: { not: 'DONE' } },
    }),
    getFinancialSummary(userId),
  ]);

  const totalTasks = taskStats.reduce((sum, group) => sum + group._count.id, 0);
  const doneTasks = taskStats.find((group) => group.status === 'DONE')?._count.id || 0;

  return {
    projectCount,
    totalTasks,
    doneTasks,
    completionRate: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
    totalCost: finance.expense,
    monthlyIncome: finance.income,
    estimatedProfit: finance.profit,
    overdueCount,
  };
}

export async function getRecentTasks(userId: string) {
  return prisma.task.findMany({
    where: { project: { ownerId: userId }, status: { not: 'DONE' } },
    orderBy: [{ dueDate: 'asc' }, { priority: 'asc' }],
    take: 20,
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
