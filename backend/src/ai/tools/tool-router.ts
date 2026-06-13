import { ToolDefinition } from './types';

// ═══ 工具智能路由 ═══
// 根据用户消息关键词，只加载相关工具，减少 token 浪费
// 不依赖 AI，纯代码匹配，零延迟

// ─── 工具分组（按功能域）───

interface ToolGroup {
  name: string;
  tools: string[];
  keywords: string[];
  alwaysLoad?: boolean; // 始终加载（系统工具）
}

const TOOL_GROUPS: ToolGroup[] = [
  // 系统工具 — 始终加载
  {
    name: 'system',
    tools: ['get_current_time'],
    keywords: [],
    alwaysLoad: true,
  },

  // 通知工具 — 始终加载（AI 可能随时需要推送）
  {
    name: 'notification',
    tools: ['send_email', 'send_webhook', 'undo_last_tool'],
    keywords: [],
    alwaysLoad: true,
  },

  // 💰 财务
  {
    name: 'finance',
    tools: [
      'get_profit_analysis', 'get_cash_flow', 'get_cost_breakdown',
      'get_revenue_by_client', 'get_project_margin_ranking',
    ],
    keywords: [
      '利润', '盈利', '盈亏', '赚', '亏', '收入', '支出', '成本', '费用',
      '报价', '预算', '现金流', '收支', '财务', '账', '金额', '价格',
      '赚钱', '不划算', '利润率', '毛利', '净利润', 'margin', 'profit',
      '客户价值', '哪个客户最赚钱', '排名',
    ],
  },

  // 📋 工作/项目/任务
  {
    name: 'work',
    tools: [
      'get_today_focus', 'get_overdue_tasks', 'get_project_progress', 'get_schedule',
      'create_project', 'update_project', 'create_task', 'update_task_status',
      'log_time', 'delete_task',
    ],
    keywords: [
      '任务', '项目', '排期', '进度', '完成', '待办', '延期', '工时',
      '今天做什么', '有什么任务', '日程', '安排', '计划', '截止',
      '创建', '新建', '添加', '删除', '修改', '更新', '标记',
      '做完了', '完成了', '开始了', '阻塞', '延期', '过期',
      '订单', '项目管理', '工作', 'focus', 'todo', 'task', 'project',
    ],
  },

  // 👥 客户
  {
    name: 'client',
    tools: [
      'create_customer', 'update_customer', 'get_client_follow_up',
      'get_client_insights', 'log_communication', 'get_client_ranking',
    ],
    keywords: [
      '客户', '跟进', '沟通', '联系', '签约', '拜访', '洽谈',
      '客户信息', '客户详情', '客户排名', '客户价值',
      '添加客户', '新客户', '大客户', 'VIP', '潜在客户',
    ],
  },

  // 🎯 目标/周报
  {
    name: 'goal',
    tools: [
      'get_goal_progress', 'get_weekly_review', 'suggest_weekly_plan',
      'get_business_health',
    ],
    keywords: [
      '目标', '周报', '业绩', '健康', '总结', '回顾',
      '这周做了什么', '本周', '完成率', 'KPI', 'OKR',
      '建议', '规划', '周计划',
    ],
  },

  // 📅 排期智能
  {
    name: 'schedule',
    tools: [
      'complexity_assessment', 'insertion_evaluation', 'rebalance_suggest',
      'schedule_advice', 'historical_accuracy',
    ],
    keywords: [
      '排期', '复杂度', '插入', '调度', '工时估算', '准确率',
      '紧急任务', '加塞', '重排', '瓶颈', '优先级评估',
      '评估复杂度', '排期建议',
    ],
  },

  // 🔍 搜索（通用搜索）
  {
    name: 'search',
    tools: [
      'search_searxng', 'search_tavily', 'search_duckduckgo', 'search_sogou',
      'fetch_web_content',
    ],
    keywords: [
      '搜索', '搜一下', '查一下', '查查', '帮我查', '调研',
      '了解一下', '什么是', '怎么', '为什么', '哪个好',
      '对比', '比较', '推荐', '评测', '教程', '攻略',
      '行情', '趋势', '最新', '新闻', '资讯',
      'search', 'google', '百度',
    ],
  },

  // 📰 专项信息源
  {
    name: 'info',
    tools: [
      'search_google_news', 'search_daily_hot', 'search_world_bank',
      'github_trending', 'hacker_news', 'npm_search',
      'exchange_rate', 'dev_to', 'product_hunt',
    ],
    keywords: [
      '热点', '热搜', '新闻', '汇率', '美元', '人民币',
      'npm', 'github', '开源', 'trending', '技术文章',
      '新产品', 'SaaS', '产品', 'GDP', '人口', '宏观',
      '科技', '创投', 'Hacker News', 'Dev.to', 'Product Hunt',
      '新闻', '今日头条', '36kr', '虎嗅',
    ],
  },
];

// ─── 核心路由函数 ───

/**
 * 根据用户消息选择相关工具
 * @param message 用户输入
 * @param allTools 全部工具列表
 * @returns 筛选后的工具列表
 */
export function selectRelevantTools(
  message: string,
  allTools: ToolDefinition[],
): { tools: ToolDefinition[]; matchedGroups: string[]; totalTools: number } {
  const lower = message.toLowerCase();
  const selectedToolNames = new Set<string>();
  const matchedGroups: string[] = [];

  // 1. 始终加载的工具
  for (const group of TOOL_GROUPS) {
    if (group.alwaysLoad) {
      group.tools.forEach(name => selectedToolNames.add(name));
      matchedGroups.push(group.name);
    }
  }

  // 2. 关键词匹配
  for (const group of TOOL_GROUPS) {
    if (group.alwaysLoad) continue;

    const matched = group.keywords.some(kw => lower.includes(kw.toLowerCase()));
    if (matched) {
      group.tools.forEach(name => selectedToolNames.add(name));
      matchedGroups.push(group.name);
    }
  }

  // 3. 如果没匹配到任何组 → 加载全部（兜底）
  if (matchedGroups.length <= 2) { // 只有 system + notification
    return {
      tools: allTools,
      matchedGroups: ['all (兜底)'],
      totalTools: allTools.length,
    };
  }

  // 4. 按 selectedToolNames 过滤
  const selected = allTools.filter(t => selectedToolNames.has(t.name));

  // 5. 安全检查：至少保留 5 个工具（防止过滤过狠）
  if (selected.length < 5) {
    return {
      tools: allTools,
      matchedGroups: ['all (工具过少兜底)'],
      totalTools: allTools.length,
    };
  }

  return {
    tools: selected,
    matchedGroups,
    totalTools: selected.length,
  };
}
