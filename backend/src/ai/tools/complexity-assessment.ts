import type { ToolDefinition } from './types';
import { prisma } from '../../server';

/**
 * AI 复杂度评估工具
 * 分析项目描述、技术栈、依赖因素，输出复杂度评分和修正工时
 */
export const complexityAssessmentTool: ToolDefinition = {
  name: 'assess_complexity',
  description: '评估项目/任务的复杂度，根据描述、技术栈、历史数据给出复杂度评分和修正工时建议。当用户说"这个项目复杂吗"、"评估一下工时"时调用。',
  category: 'schedule',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: '项目 ID（可选，不传则评估所有项目）' },
      taskId: { type: 'string', description: '任务 ID（可选，评估特定任务）' },
      description: { type: 'string', description: '项目/任务描述文本' },
      techStack: { type: 'string', description: '涉及的技术栈（如 React, Node.js, 部署等）' },
    },
    required: ['description'],
  },
  handler: async (args: Record<string, unknown>, userId: string) => {
    const { projectId, taskId, description, techStack } = args as {
      projectId?: string;
      taskId?: string;
      description: string;
      techStack?: string;
    };

    // 获取历史工时数据（如果有）
    let historicalData = null;
    if (taskId) {
      const task = await prisma.task.findFirst({
        where: { id: taskId, project: { ownerId: userId } },
        include: { project: { select: { name: true } } },
      });
      if (task) {
        historicalData = {
          title: task.title,
          estimatedHours: task.estimatedHours,
          actualHours: task.actualHours,
          projectName: task.project?.name,
        };
      }
    }

    // 基于描述的复杂度分析
    const complexityFactors = analyzeDescription(description, techStack);

    // 如果有历史数据，计算预估准确度
    let accuracyNote = '';
    if (historicalData?.actualHours && historicalData?.estimatedHours) {
      const ratio = historicalData.actualHours / historicalData.estimatedHours;
      if (ratio > 1.3) {
        accuracyNote = `历史数据显示该用户预估偏乐观（实际/预估=${ratio.toFixed(1)}x）`;
      } else if (ratio < 0.7) {
        accuracyNote = `历史数据显示该用户预估偏保守（实际/预估=${ratio.toFixed(1)}x）`;
      }
    }

    return {
      complexityScore: complexityFactors.score, // 1-10
      complexityLevel: complexityFactors.level, // 低/中/高/极高
      factors: complexityFactors.factors,
      suggestedMultiplier: complexityFactors.multiplier,
      accuracyNote,
      historicalData,
      recommendation: complexityFactors.recommendation,
    };
  },
};

/** 分析描述文本的复杂度 */
function analyzeDescription(description: string, techStack?: string) {
  const factors: string[] = [];
  let score = 5; // 基础分

  // 关键词检测
  const highComplexityKeywords = ['部署', '上线', '生产环境', '数据库', '架构', '微服务', '并发', '安全', '加密', '支付'];
  const mediumComplexityKeywords = ['API', '接口', '表单', '列表', '搜索', '筛选', '分页', '权限', '角色'];
  const lowComplexityKeywords = ['文档', '样式', '调整', '优化', '修复', '测试'];

  for (const kw of highComplexityKeywords) {
    if (description.includes(kw)) { score += 1; factors.push(`涉及${kw}（高复杂度）`); }
  }
  for (const kw of mediumComplexityKeywords) {
    if (description.includes(kw)) { score += 0.5; factors.push(`涉及${kw}（中复杂度）`); }
  }
  for (const kw of lowComplexityKeywords) {
    if (description.includes(kw)) { score -= 0.5; factors.push(`涉及${kw}（低复杂度）`); }
  }

  // 技术栈分析
  if (techStack) {
    const complexTech = ['React', 'Vue', 'Next.js', 'Node.js', 'Python', 'Java', 'Go', 'Rust', 'Docker', 'K8s'];
    for (const tech of complexTech) {
      if (techStack.includes(tech)) { score += 0.3; factors.push(`使用${tech}`); }
    }
  }

  // 描述长度（越长可能越复杂）
  if (description.length > 200) { score += 0.5; factors.push('描述详细，可能涉及多个子任务'); }
  if (description.length < 20) { score -= 0.5; factors.push('描述简短，需确认细节'); }

  // 限制分数范围
  score = Math.max(1, Math.min(10, Math.round(score * 10) / 10));

  // 复杂度等级
  let level = '中';
  let multiplier = 1.0;
  if (score <= 3) { level = '低'; multiplier = 0.8; }
  else if (score <= 5) { level = '中'; multiplier = 1.0; }
  else if (score <= 7) { level = '高'; multiplier = 1.3; }
  else { level = '极高'; multiplier = 1.6; }

  const recommendation = score > 7
    ? '建议拆分为多个子任务，或增加预估工时 30-60%'
    : score > 5
    ? '建议预估工时增加 20-30%'
    : '当前预估工时基本合理';

  return { score, level, factors, multiplier, recommendation };
}
