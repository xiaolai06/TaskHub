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
import { searchTavilyTool, searchDuckDuckGoTool } from './search-web';
import { searchSogouTool } from './sogou-search';
import { searchSearXNGTool } from './searxng-search';
import { fetchWebContentTool } from './fetch-content';
import { searchGoogleNewsTool } from './google-news';
import { searchDailyHotTool } from './daily-hot';
import { searchWorldBankTool } from './world-bank';
import { githubTrendingTool } from './github-trending';
import { hackerNewsTool } from './hacker-news';
import { npmSearchTool } from './npm-search';
import { exchangeRateTool } from './exchange-rate';
import { devToTool } from './dev-to';
import { productHuntTool } from './product-hunt';
import { getCurrentTimeTool } from './get-current-time';
// 排期智能工具
import { complexityAssessmentTool } from './complexity-assessment';
import { insertionEvaluationTool } from './insertion-evaluation';
import { rebalanceSuggestTool } from './rebalance-suggest';
import { scheduleAdviceTool } from './schedule-advice';
import { historicalAccuracyTool } from './historical-accuracy';
// 通知推送工具
import { sendEmailTool } from './send-email';
import { sendWebhookTool } from './send-webhook';
import { undoLastToolTool } from './undo-last-tool';

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
  // 🔍 搜索（命名明确，AI 自主选择）
  searchSearXNGTool,
  searchTavilyTool, searchDuckDuckGoTool,
  searchSogouTool,
  searchGoogleNewsTool, searchDailyHotTool, searchWorldBankTool,
  fetchWebContentTool,
  githubTrendingTool, hackerNewsTool, npmSearchTool,
  exchangeRateTool, devToTool, productHuntTool,
  // 🕐 system
  getCurrentTimeTool,
  // 📨 通知推送
  sendEmailTool, sendWebhookTool, undoLastToolTool,
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
