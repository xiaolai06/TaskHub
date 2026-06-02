import type { ToolDefinition } from './types';
import { prisma } from '../../server';
import { detectDelays, detectConflicts } from '../../services/scheduler.service';

/**
 * 排期重平衡建议工具
 * 检测延期/冲突，给出调整方案
 */
export const rebalanceSuggestTool: ToolDefinition = {
  name: 'suggest_rebalance',
  description: '检测项目排期问题（延期、冲突、工时超载），给出调整建议方案。当用户说"排期有问题吗"、"需要调整吗"时调用。',
  category: 'schedule',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: '项目 ID' },
      dailyHourLimit: { type: 'number', description: '每日工时上限（默认8）' },
    },
    required: ['projectId'],
  },
  handler: async (args: Record<string, unknown>, userId: string) => {
    const { projectId, dailyHourLimit = 8 } = args as {
      projectId: string;
      dailyHourLimit?: number;
    };

    // 1. 检测延期任务
    const delayedTasks = await detectDelays(userId, projectId);

    // 2. 检测冲突
    const conflicts = await detectConflicts(userId, { projectId, dailyHourLimit });

    // 3. 获取项目信息
    const project = await prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
      select: { name: true, endDate: true, budget: true },
    });

    // 4. 生成调整建议
    const suggestions: Array<{
      type: 'delay' | 'conflict' | 'overload';
      severity: 'low' | 'medium' | 'high';
      description: string;
      action: string;
      affectedTasks?: string[];
    }> = [];

    // 延期任务建议
    for (const task of delayedTasks) {
      const severity = task.overdueDays > 7 ? 'high' : task.overdueDays > 3 ? 'medium' : 'low';
      suggestions.push({
        type: 'delay',
        severity,
        description: `「${task.title}」已延期 ${task.overdueDays} 天`,
        action: task.overdueDays > 5
          ? '建议与客户沟通延期，或降低优先级让其他任务优先完成'
          : '建议调整截止日期，或增加每日工时',
        affectedTasks: [task.title],
      });
    }

    // 时间重叠冲突建议
    for (const conflict of conflicts.timeOverlapConflicts) {
      suggestions.push({
        type: 'conflict',
        severity: conflict.overlapDays > 3 ? 'high' : 'medium',
        description: `「${conflict.task1.title}」与「${conflict.task2.title}」时间重叠 ${conflict.overlapDays} 天`,
        action: '建议错开两个任务的开始时间，或调整其中一个的优先级',
        affectedTasks: [conflict.task1.title, conflict.task2.title],
      });
    }

    // 工时超载建议
    if (conflicts.overloadedDays.length > 0) {
      const maxOverload = Math.max(...conflicts.overloadedDays.map(d => d.hours));
      suggestions.push({
        type: 'overload',
        severity: maxOverload > 12 ? 'high' : 'medium',
        description: `有 ${conflicts.overloadedDays.length} 天工时超过 ${dailyHourLimit} 小时上限`,
        action: '建议将部分任务移到其他天，或调整每日工时上限',
        affectedTasks: conflicts.overloadedDays.flatMap(d => d.tasks),
      });
    }

    // 5. 综合建议
    const totalIssues = suggestions.length;
    const highSeverity = suggestions.filter(s => s.severity === 'high').length;

    let overallRecommendation = '';
    if (totalIssues === 0) {
      overallRecommendation = '排期健康，无需调整';
    } else if (highSeverity === 0) {
      overallRecommendation = `有 ${totalIssues} 个轻微问题，建议适当调整`;
    } else {
      overallRecommendation = `有 ${highSeverity} 个严重问题，建议立即处理`;
    }

    return {
      project: project?.name,
      summary: {
        totalIssues,
        delayedTasks: delayedTasks.length,
        conflicts: conflicts.totalConflicts,
        overloadedDays: conflicts.overloadedDays.length,
      },
      suggestions,
      overallRecommendation,
    };
  },
};
