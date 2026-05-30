import { prisma } from '../server';
import { CreateTaskInput, UpdateTaskInput, TaskQueryInput } from '../validators/task.schema';
import { Prisma } from '@prisma/client';

export async function findAll(userId: string, filters: TaskQueryInput) {
  const {
    page = 1, limit = 50, status, priority, projectId,
    assigneeId, parentId, search, dueDateFrom, dueDateTo,
    sortBy = 'priority', sortOrder = 'asc',
  } = filters;

  // 构建 where 条件
  const where: Prisma.TaskWhereInput = {
    project: { ownerId: userId },
  };

  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (projectId) where.projectId = projectId;
  if (assigneeId) where.assigneeId = assigneeId;
  if (parentId !== undefined) where.parentId = parentId;

  // 关键词搜索
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
    ];
  }

  // 日期范围筛选
  if (dueDateFrom || dueDateTo) {
    where.dueDate = {};
    if (dueDateFrom) where.dueDate.gte = new Date(dueDateFrom);
    if (dueDateTo) {
      const to = new Date(dueDateTo);
      to.setHours(23, 59, 59, 999);
      where.dueDate.lte = to;
    }
  }

  // 排序：priority 始终作为第一排序字段，sortBy 作为第二排序字段（跳过重复）
  const orderBy: Prisma.TaskOrderByWithRelationInput[] = [{ priority: 'asc' }];
  if (sortBy !== 'priority') {
    orderBy.push({ [sortBy]: sortOrder } as Prisma.TaskOrderByWithRelationInput);
  }

  const [data, total] = await Promise.all([
    prisma.task.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy,
      include: {
        assignee: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, budget: true } },
        children: {
          select: { id: true, title: true, status: true, progress: true },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { children: true } },
      },
    }),
    prisma.task.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function findById(userId: string, id: string) {
  return prisma.task.findFirst({
    where: { id, project: { ownerId: userId } },
    include: {
      assignee: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, budget: true } },
      children: {
        orderBy: { createdAt: 'asc' },
        include: { assignee: { select: { id: true, name: true } } },
      },
      parent: { select: { id: true, title: true } },
    },
  });
}

export async function getByProject(userId: string, projectId: string) {
  const tasks = await prisma.task.findMany({
    where: { projectId, project: { ownerId: userId }, parentId: null },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    include: {
      assignee: { select: { id: true, name: true } },
      children: {
        orderBy: { createdAt: 'asc' },
        include: { assignee: { select: { id: true, name: true } } },
      },
      _count: { select: { children: true } },
    },
  });

  // 聚合每个任务的花销
  return Promise.all(
    tasks.map(async (t) => {
      const costAgg = await prisma.costRecord.aggregate({
        where: { taskId: t.id },
        _sum: { amount: true },
      });
      const childCostAgg = await prisma.costRecord.aggregate({
        where: { taskId: { in: t.children.map((c) => c.id) } },
        _sum: { amount: true },
      });
      return {
        ...t,
        taskCost: costAgg._sum.amount ?? 0,
        childrenCost: childCostAgg._sum.amount ?? 0,
      };
    }),
  );
}

export async function create(userId: string, data: CreateTaskInput) {
  // 验证项目属于当前用户
  const project = await prisma.project.findFirst({
    where: { id: data.projectId, ownerId: userId },
  });
  if (!project) return null;

  return prisma.task.create({
    data: {
      title: data.title,
      description: data.description,
      status: data.status ?? 'TODO',
      priority: data.priority ?? 'MEDIUM',
      estimatedHours: data.estimatedHours ?? 0,
      actualHours: data.actualHours,
      cost: data.cost ?? 0,
      costNote: data.costNote,
      blockedReason: data.blockedReason,
      startDate: data.startDate ? new Date(data.startDate) : null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      projectId: data.projectId,
      assigneeId: data.assigneeId,
      parentId: data.parentId,
    },
    include: {
      assignee: { select: { id: true, name: true } },
      children: true,
    },
  });
}

export async function update(userId: string, id: string, data: UpdateTaskInput) {
  const task = await prisma.task.findFirst({
    where: { id, project: { ownerId: userId } },
  });
  if (!task) return null;

  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === 'DONE') updateData.completedAt = new Date();
    if (data.status !== 'DONE') updateData.completedAt = null;
    // 切换到非 BLOCKED 时清空阻塞原因
    if (data.status !== 'BLOCKED') updateData.blockedReason = null;
  }
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.estimatedHours !== undefined) updateData.estimatedHours = data.estimatedHours;
  if (data.actualHours !== undefined) updateData.actualHours = data.actualHours;
  if (data.cost !== undefined) updateData.cost = data.cost;
  if (data.costNote !== undefined) updateData.costNote = data.costNote;
  if (data.blockedReason !== undefined) updateData.blockedReason = data.blockedReason;
  if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null;
  if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  if (data.completedAt !== undefined) updateData.completedAt = data.completedAt ? new Date(data.completedAt) : null;
  if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId;
  if (data.parentId !== undefined) updateData.parentId = data.parentId;
  if (data.progress !== undefined) updateData.progress = data.progress;

  const updated = await prisma.task.update({ where: { id }, data: updateData });

  // 如果有父任务，自动更新父任务进度
  if (updated.parentId) {
    await updateParentProgress(updated.parentId);
  }

  return updated;
}

export async function remove(userId: string, id: string) {
  const task = await prisma.task.findFirst({
    where: { id, project: { ownerId: userId } },
  });
  if (!task) return null;

  const parentId = task.parentId;

  // 级联删除：子任务 + 成本记录 + 本任务
  await prisma.$transaction([
    prisma.costRecord.deleteMany({ where: { taskId: id } }),
    prisma.task.deleteMany({ where: { parentId: id } }),
    prisma.task.delete({ where: { id } }),
  ]);

  if (parentId) {
    await updateParentProgress(parentId);
  }

  return { deleted: true };
}

export async function updateStatus(userId: string, id: string, status: string, blockedReason?: string) {
  return update(userId, id, {
    status: status as 'TODO' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED',
    blockedReason,
  });
}

/** 自动计算父任务进度（子任务完成比例），不覆盖手动设置的 BLOCKED 状态 */
async function updateParentProgress(parentId: string) {
  const parent = await prisma.task.findUnique({ where: { id: parentId }, select: { status: true } });
  if (!parent || parent.status === 'BLOCKED') return;

  const children = await prisma.task.findMany({
    where: { parentId },
    select: { status: true },
  });
  if (children.length === 0) return;

  const doneCount = children.filter((c) => c.status === 'DONE').length;
  const progress = Math.round((doneCount / children.length) * 100);

  await prisma.task.update({
    where: { id: parentId },
    data: {
      progress,
      status: progress >= 100 ? 'DONE' : progress > 0 ? 'IN_PROGRESS' : 'TODO',
    },
  });
}
