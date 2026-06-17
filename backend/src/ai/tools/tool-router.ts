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

  // 💰 财务（增加 create_cost, delete_cost）
  {
    name: 'finance',
    tools: [
      'get_profit_analysis', 'get_cash_flow', 'get_cost_breakdown',
      'get_revenue_by_client', 'get_project_margin_ranking',
      'create_cost', 'delete_cost',
      'get_financial_trends', 'get_comparison',
    ],
    keywords: [
      '利润', '盈利', '盈亏', '赚', '亏', '收入', '支出', '成本', '费用',
      '报价', '预算', '现金流', '收支', '财务', '账', '金额', '价格',
      '赚钱', '不划算', '利润率', '毛利', '净利润', 'margin', 'profit',
      '客户价值', '哪个客户最赚钱', '排名', '记一笔成本', '成本录入',
      '趋势', '走势', '变化', '环比', '对比', '上月',
    ],
  },

  // 📋 工作/项目/任务（增加 list_projects, get_project_detail, archive_project, list_tasks, get_task_stats）
  {
    name: 'work',
    tools: [
      'get_today_focus', 'get_overdue_tasks', 'get_project_progress', 'get_schedule',
      'create_project', 'update_project', 'create_task', 'update_task_status',
      'log_time', 'delete_task', 'delete_project',
      'list_projects', 'get_project_detail', 'archive_project',
      'list_tasks', 'get_task_stats',
    ],
    keywords: [
      '任务', '项目', '排期', '进度', '完成', '待办', '延期', '工时',
      '今天做什么', '有什么任务', '日程', '安排', '计划', '截止',
      '创建', '新建', '添加', '删除', '修改', '更新', '标记',
      '做完了', '完成了', '开始了', '阻塞', '延期', '过期',
      '订单', '项目管理', '工作', 'focus', 'todo', 'task', 'project',
      '归档', '项目列表', '项目详情', '任务统计', '完成率',
    ],
  },

  // 👥 客户（增加 list_customers, delete_customer）
  {
    name: 'client',
    tools: [
      'create_customer', 'update_customer', 'get_client_follow_up',
      'get_client_insights', 'log_communication', 'get_client_ranking',
      'list_customers', 'delete_customer',
    ],
    keywords: [
      '客户', '跟进', '沟通', '联系', '签约', '拜访', '洽谈',
      '客户信息', '客户详情', '客户排名', '客户价值',
      '添加客户', '新客户', '大客户', 'VIP', '潜在客户',
      '客户列表', '删除客户',
    ],
  },

  // 🎯 目标/周报（增加 list_goals, get_goal_overview, create_goal, update_goal, update_goal_progress）
  {
    name: 'goal',
    tools: [
      'get_goal_progress', 'get_weekly_review', 'suggest_weekly_plan',
      'get_business_health',
      'list_goals', 'get_goal_overview', 'create_goal', 'update_goal', 'update_goal_progress',
    ],
    keywords: [
      '目标', '周报', '业绩', '健康', '总结', '回顾',
      '这周做了什么', '本周', '完成率', 'KPI', 'OKR',
      '建议', '规划', '周计划', '目标总览', '创建目标', '更新目标',
    ],
  },

  // 💳 收支流水（新增）
  {
    name: 'transaction',
    tools: ['list_transactions', 'create_transaction', 'update_transaction', 'delete_transaction'],
    keywords: [
      '流水', '收入', '支出', '记账', '入账', '交易',
      '收支记录', '账单', '记一笔', '收入记录', '支出明细',
    ],
  },

  // 💵 回款（新增）
  {
    name: 'payment',
    tools: ['create_payment', 'list_payments', 'get_receivables', 'get_aging_analysis'],
    keywords: [
      '收款', '回款', '应收账款', '账龄',
      '付款', '首付', '尾款', '进度款',
      '收钱', '收到款', '回款率',
    ],
  },

  // ⏱ 工时/待办（新增）
  {
    name: 'work_timer',
    tools: ['get_today_entries', 'get_active_timer', 'list_todos', 'add_todo', 'toggle_todo', 'start_timer', 'stop_timer'],
    keywords: [
      '工时', '计时', '待办', '今日任务', '打卡',
      '计时器', '工作时间', '记录工时',
      '开始计时', '停止计时', '计时开始', '计时结束',
      '今日待办', '加个待办', '完成待办',
    ],
  },

  // 📊 报表（新增）
  {
    name: 'report',
    tools: ['get_report_overview', 'get_project_ranking', 'get_cost_structure', 'get_time_analysis'],
    keywords: [
      '报表', '报告', '排名', '分析报告',
      '成本结构', '工时分析', '时间分析',
      '项目排名', '财务报表',
    ],
  },

  // 📈 仪表盘（新增）
  {
    name: 'dashboard',
    tools: ['get_dashboard_summary', 'get_recent_activity'],
    keywords: [
      '仪表盘', '总览', '概况', '汇总',
      '最近活动', '最近做了什么', '整体情况',
    ],
  },

  // 🔔 通知查询（新增）
  {
    name: 'notification_query',
    tools: ['list_notifications', 'get_unread_count', 'mark_as_read'],
    keywords: [
      '通知', '未读', '消息提醒',
      '查看通知', '通知数量', '标记已读',
    ],
  },

  // 📦 订阅（新增）
  {
    name: 'subscription',
    tools: ['list_subscriptions', 'get_subscription_cost', 'create_subscription', 'pause_subscription', 'resume_subscription', 'update_subscription', 'delete_subscription'],
    keywords: [
      '订阅', '续费', '会员', 'SaaS',
      '订阅费', '暂停订阅', '恢复订阅',
      '月费', '年费', '订阅服务',
    ],
  },

  // 📅 排期智能
  {
    name: 'schedule',
    tools: [
      'assess_complexity', 'evaluate_insertion', 'rebalance_suggest',
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
      '今日头条', '36kr', '虎嗅',
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
