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
// ====== 新增：Phase 1-4 工具 ======
// P0: 流水
import { listTransactionsTool, createTransactionTool, updateTransactionTool, deleteTransactionTool } from './transaction-tools';
// P0: 回款
import { createPaymentTool, listPaymentsTool, getReceivablesTool, getAgingAnalysisTool } from './payment-tools';
// P0: 成本写操作
import { createCostTool, deleteCostTool } from './cost-write';
// P0: 项目查询
import { listProjectsTool, getProjectDetailTool, archiveProjectTool } from './project-query';
// P0: 任务查询
import { listTasksTool, getTaskStatsTool } from './task-query';
// P1: 客户扩展
import { listCustomersTool, deleteCustomerTool } from './customer-extra';
// P1: 目标写操作
import { listGoalsTool, getGoalOverviewTool, createGoalTool, updateGoalTool, updateGoalProgressTool } from './goal-write';
// P1: 工时/待办
import { getTodayEntriesTool, getActiveTimerTool, listTodosTool, addTodoTool, toggleTodoTool } from './work-timer';
// P2: 报表
import { getReportOverviewTool, getProjectRankingTool, getCostStructureTool, getTimeAnalysisTool } from './report-tools';
// P2: 仪表盘
import { getDashboardSummaryTool, getRecentActivityTool } from './dashboard-tools';
// P2: 通知
import { listNotificationsTool, getUnreadCountTool, markAsReadTool } from './notification-tools';
// P3: 订阅
import { listSubscriptionsTool, getSubscriptionCostTool, createSubscriptionTool, pauseSubscriptionTool, resumeSubscriptionTool } from './subscription-tools';

const allTools: ToolDefinition[] = [
  // 💰 finance（原 5 + 新增 2 = 7）
  getProfitAnalysisTool, getCashFlowTool, getCostBreakdownTool, getRevenueByClientTool, getProjectMarginRankingTool,
  createCostTool, deleteCostTool,
  // 📋 work（原 10 + 新增 6 = 16）
  getTodayFocusTool, getOverdueTasksTool, getProjectProgressTool, getScheduleTool,
  createProjectTool, updateProjectTool, createTaskTool, updateTaskStatusTool, logTimeTool, deleteTaskTool,
  listProjectsTool, getProjectDetailTool, archiveProjectTool,
  listTasksTool, getTaskStatsTool,
  // 👥 client（原 6 + 新增 2 = 8）
  createCustomerTool, updateCustomerTool, getClientFollowUpTool, getClientInsightsTool, logCommunicationTool, getClientRankingTool,
  listCustomersTool, deleteCustomerTool,
  // 🎯 goal（原 4 + 新增 5 = 9）
  getGoalProgressTool, getWeeklyReviewTool, suggestWeeklyPlanTool, getBusinessHealthTool,
  listGoalsTool, getGoalOverviewTool, createGoalTool, updateGoalTool, updateGoalProgressTool,
  // 💳 transaction（新增 4）
  listTransactionsTool, createTransactionTool, updateTransactionTool, deleteTransactionTool,
  // 💵 payment（新增 4）
  createPaymentTool, listPaymentsTool, getReceivablesTool, getAgingAnalysisTool,
  // ⏱ work_timer（新增 5）
  getTodayEntriesTool, getActiveTimerTool, listTodosTool, addTodoTool, toggleTodoTool,
  // 📊 report（新增 4）
  getReportOverviewTool, getProjectRankingTool, getCostStructureTool, getTimeAnalysisTool,
  // 📈 dashboard（新增 2）
  getDashboardSummaryTool, getRecentActivityTool,
  // 🔔 notification（原 3 + 新增 3 = 6，其中 send_email/send_webhook/undo_last_tool 保留）
  listNotificationsTool, getUnreadCountTool, markAsReadTool,
  // 📦 subscription（新增 5）
  listSubscriptionsTool, getSubscriptionCostTool, createSubscriptionTool, pauseSubscriptionTool, resumeSubscriptionTool,
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
