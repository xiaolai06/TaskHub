import type { ToolDefinition } from './types';
import { prisma } from '../../server';

/**
 * 历史工时准确度工具
 * 对比预估工时vs实际工时，学习用户的预估偏差模式
 */
export const historicalAccuracyTool: ToolDefinition = {
  name: 'get_historical_accuracy',
  description: '分析历史任务的工时预估准确度，学习用户的预估偏差模式，用于修正未来的工时预估。当用户问"预估准吗"、"我一般超时多少"时调用。',
  category: 'schedule',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: '项目 ID（可选，不传则分析所有项目）' },
    },
  },
  handler: async (args: Record<string, unknown>, userId: string) => {
    const { projectId } = args as { projectId?: string };

    // 查询已完成且有实际工时的任务
    const where: Record<string, unknown> = {
      project: { ownerId: userId },
      status: 'DONE',
      actualHours: { not: null },
    };
    if (projectId) where.projectId = projectId;

    const tasks = await prisma.task.findMany({
      where,
      select: {
        title: true,
        estimatedHours: true,
        actualHours: true,
        project: { select: { name: true } },
      },
      orderBy: { completedAt: 'desc' },
      take: 50, // 最近50个任务
    });

    if (tasks.length === 0) {
      return {
        message: '暂无已完成且记录了实际工时的任务',
        suggestion: '完成任务后记录实际工时，系统会自动学习你的预估偏差',
      };
    }

    // 计算准确度统计
    let totalEstimated = 0;
    let totalActual = 0;
    let overestimated = 0; // 预估偏高（实际更少）
    let underestimated = 0; // 预估偏低（实际更多）
    const deviations: number[] = [];

    for (const task of tasks) {
      if (task.actualHours === null) continue;
      totalEstimated += task.estimatedHours;
      totalActual += task.actualHours;

      const deviation = (task.actualHours - task.estimatedHours) / task.estimatedHours;
      deviations.push(deviation);

      if (deviation > 0.1) underestimated++; // 实际比预估多10%以上
      else if (deviation < -0.1) overestimated++; // 实际比预估少10%以上
    }

    const avgDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length;
    const accuracyRate = 1 - Math.abs(avgDeviation);
    const avgMultiplier = totalActual / totalEstimated;

    // 按项目分组统计
    const byProject: Record<string, { estimated: number; actual: number; count: number }> = {};
    for (const task of tasks) {
      const name = task.project?.name || '未分类';
      if (!byProject[name]) byProject[name] = { estimated: 0, actual: 0, count: 0 };
      byProject[name].estimated += task.estimatedHours;
      byProject[name].actual += task.actualHours || 0;
      byProject[name].count++;
    }

    return {
      summary: {
        totalTasks: tasks.length,
        avgDeviation: Math.round(avgDeviation * 100) + '%',
        accuracyRate: Math.round(accuracyRate * 100) + '%',
        avgMultiplier: Math.round(avgMultiplier * 100) / 100,
      },
      pattern: {
        overestimated, // 预估偏高（实际更快完成）
        underestimated, // 预估偏低（实际更慢完成）
        tendency: avgDeviation > 0.1 ? '偏乐观（经常低估工时）'
          : avgDeviation < -0.1 ? '偏保守（经常高估工时）'
          : '预估较准确',
      },
      recommendation: avgMultiplier > 1.2
        ? '建议预估工时乘以 ' + avgMultiplier.toFixed(1) + 'x'
        : avgMultiplier < 0.8
        ? '你的预估偏保守，可以适当减少预估工时'
        : '你的预估比较准确，保持当前方式',
      byProject: Object.entries(byProject).map(([name, data]) => ({
        name,
        estimated: data.estimated,
        actual: data.actual,
        multiplier: Math.round((data.actual / data.estimated) * 100) / 100,
        count: data.count,
      })),
    };
  },
};
