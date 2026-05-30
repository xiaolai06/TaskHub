// 工具注册中心
import { ToolDefinition } from './types';

import { getProfitAnalysisTool } from './get-profit-analysis';
import { getCashFlowTool } from './get-cash-flow';
import { getCostBreakdownTool } from './get-cost-breakdown';
import { getRevenueByClientTool, getProjectMarginRankingTool } from './get-revenue-by-client';
import { getTodayFocusTool, getOverdueTasksTool, getProjectProgressTool } from './get-today-focus';
import { createTaskTool, updateTaskStatusTool, logTimeTool, getScheduleTool } from './create-task';
import { getClientFollowUpTool, getClientInsightsTool, logCommunicationTool, getClientRankingTool } from './get-client-follow-up';
import { getGoalProgressTool, getWeeklyReviewTool, suggestWeeklyPlanTool, getBusinessHealthTool } from './get-goal-progress';

const allTools: ToolDefinition[] = [
  getProfitAnalysisTool, getCashFlowTool, getCostBreakdownTool, getRevenueByClientTool, getProjectMarginRankingTool,
  getTodayFocusTool, getOverdueTasksTool, getProjectProgressTool, createTaskTool, updateTaskStatusTool, logTimeTool, getScheduleTool,
  getClientFollowUpTool, getClientInsightsTool, logCommunicationTool, getClientRankingTool,
  getGoalProgressTool, getWeeklyReviewTool, suggestWeeklyPlanTool, getBusinessHealthTool,
];

const toolMap = new Map<string, ToolDefinition>();
for (const t of allTools) toolMap.set(t.name, t);

export function getAllTools(): ToolDefinition[] { return allTools; }
export function getTool(name: string): ToolDefinition | undefined { return toolMap.get(name); }
export function getToolsByCategory(category: string): ToolDefinition[] { return allTools.filter(t => t.category === category); }
export function getWriteTools(): ToolDefinition[] { return allTools.filter(t => t.access === 'write'); }
