// 工具注册中心
import { ToolDefinition } from './types';

import { getProfitAnalysisTool } from './get-profit-analysis';
import { getCashFlowTool } from './get-cash-flow';
import { getCostBreakdownTool } from './get-cost-breakdown';
import { getRevenueByClientTool, getProjectMarginRankingTool } from './get-revenue-by-client';
import { getTodayFocusTool, getOverdueTasksTool, getProjectProgressTool } from './get-today-focus';
import { createTaskTool, updateTaskStatusTool, logTimeTool, getScheduleTool, deleteTaskTool } from './create-task';
import { createProjectTool, updateProjectTool } from './create-project';
import { createCustomerTool, updateCustomerTool, getClientFollowUpTool, getClientInsightsTool, logCommunicationTool, getClientRankingTool } from './get-client-follow-up';
import { getGoalProgressTool, getWeeklyReviewTool, suggestWeeklyPlanTool, getBusinessHealthTool } from './get-goal-progress';
import { searchWebTool } from './search-web';
import { githubTrendingTool } from './github-trending';
import { hackerNewsTool } from './hacker-news';
import { npmSearchTool } from './npm-search';
import { exchangeRateTool } from './exchange-rate';
import { devToTool } from './dev-to';
import { productHuntTool } from './product-hunt';
// 排期智能工具
import { complexityAssessmentTool } from './complexity-assessment';
import { insertionEvaluationTool } from './insertion-evaluation';
import { rebalanceSuggestTool } from './rebalance-suggest';
import { scheduleAdviceTool } from './schedule-advice';
import { historicalAccuracyTool } from './historical-accuracy';

const allTools: ToolDefinition[] = [
  // 💰 finance
  getProfitAnalysisTool, getCashFlowTool, getCostBreakdownTool, getRevenueByClientTool, getProjectMarginRankingTool,
  // 📋 work
  getTodayFocusTool, getOverdueTasksTool, getProjectProgressTool, getScheduleTool,
  createProjectTool, updateProjectTool, createTaskTool, updateTaskStatusTool, logTimeTool, deleteTaskTool,
  // 👥 client
  createCustomerTool, updateCustomerTool, getClientFollowUpTool, getClientInsightsTool, logCommunicationTool, getClientRankingTool,
  // 🎯 goal
  getGoalProgressTool, getWeeklyReviewTool, suggestWeeklyPlanTool, getBusinessHealthTool,
  // 🔍 search
  searchWebTool, githubTrendingTool, hackerNewsTool, npmSearchTool,
  exchangeRateTool, devToTool, productHuntTool,
  // 📅 schedule intelligence
  complexityAssessmentTool, insertionEvaluationTool, rebalanceSuggestTool, scheduleAdviceTool,
  historicalAccuracyTool,
];

const toolMap = new Map<string, ToolDefinition>();
for (const t of allTools) toolMap.set(t.name, t);

export const TOTAL_TOOLS = allTools.length;
export function getAllTools(): ToolDefinition[] { return allTools; }
export function getTool(name: string): ToolDefinition | undefined { return toolMap.get(name); }
export function getToolsByCategory(category: string): ToolDefinition[] { return allTools.filter(t => t.category === category); }
export function getWriteTools(): ToolDefinition[] { return allTools.filter(t => t.access === 'write'); }
