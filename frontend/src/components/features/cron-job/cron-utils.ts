import { api } from '@/lib/api';

// ═══ 类型 ═══

export interface AIModel { id: string; name: string; providerLabel: string; }
export interface WH { name: string; channel: string; }

// ═══ 常量 ═══

export const ACTION_BADGE: Record<string, { label: string; cls: string }> = {
  NOTIFY: { label: '通知', cls: 'bg-blue-50 text-blue-600' },
  AI_ANALYSIS: { label: 'AI分析', cls: 'bg-purple-50 text-purple-600' },
  WEBHOOK: { label: 'Webhook', cls: 'bg-amber-50 text-amber-600' },
};

export const CRON_LABELS: Record<string, string> = {
  '30 7 * * *': '每天 07:30', '0 8 * * *': '每天 08:00', '30 8 * * *': '每天 08:30',
  '0 9 * * *': '每天 09:00', '30 9 * * *': '每天 09:30', '0 10 * * *': '每天 10:00',
  '0 9 * * 1': '每周一 09:00', '0 10 * * 0': '每周日 10:00', '0 20 * * 0': '每周日 20:00',
  '* * * * *': '每分钟',
};

export const CRON_PRESETS = [
  { label: '每天 7:30', expr: '30 7 * * *' },
  { label: '每天 8:00', expr: '0 8 * * *' },
  { label: '每天 8:30', expr: '30 8 * * *' },
  { label: '每天 9:00', expr: '0 9 * * *' },
  { label: '每天 9:30', expr: '30 9 * * *' },
  { label: '每天 10:00', expr: '0 10 * * *' },
  { label: '每周一 9:00', expr: '0 9 * * 1' },
  { label: '每周日 10:00', expr: '0 10 * * 0' },
  { label: '每周日 20:00', expr: '0 20 * * 0' },
];

export const JOB_ICONS: Record<string, string> = {
  '成本预警': '💸', '晨间简报': '🌅',
  '客户雷达': '📡', '订单利润简报': '💰', '自动周报': '📊',
  '记忆沉淀': '🧠', '业务体检': '🫀', '到期提醒': '⏰',
};

export const CH_ICONS: Record<string, string> = {
  wechat: '💬', feishu: '🐦', dingtalk: '📌', slack: '🔔',
};

// ═══ AI 分析模板 ═══

export interface AIAnalysisTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  prompt: string;
}

export const AI_TEMPLATES: AIAnalysisTemplate[] = [
  { id: 'project-progress', name: '项目进展汇总', icon: '📋', description: '汇总所有项目的进度、风险和待办事项', prompt: '请汇总当前所有项目的进展，包括完成百分比、关键里程碑、风险项和待办事项。用简洁的列表格式呈现。' },
  { id: 'finance-analysis', name: '财务数据分析', icon: '💰', description: '分析收入支出趋势、利润和成本结构', prompt: '请分析本期的财务数据，包括收入支出趋势、利润情况、成本结构分析，并给出优化建议。' },
  { id: 'client-status', name: '客户状态扫描', icon: '📡', description: '扫描客户跟进状态、合同到期和商机', prompt: '请扫描所有客户的跟进状态，包括近期沟通记录、合同到期提醒、待跟进商机，按优先级排序。' },
  { id: 'task-summary', name: '任务完成报告', icon: '✅', description: '统计任务完成率、逾期情况和团队效率', prompt: '请统计本期的任务完成情况，包括完成率、逾期任务、团队成员工作量分布，并给出效率改进建议。' },
  { id: 'cost-alert', name: '成本预警分析', icon: '💸', description: '检测异常支出和预算超支风险', prompt: '请检测本期的异常支出情况，分析各项目预算使用率，预警可能超支的项目，并给出控制建议。' },
  { id: 'goal-progress', name: '目标进展分析', icon: '🎯', description: '分析经营目标完成度、打卡连续性和风险预警', prompt: '请分析所有经营目标的进展状态，包括各目标完成百分比、是否落后预期、打卡类目标的连续天数、风险目标的改进建议。按紧急程度排序。' },
  { id: 'custom', name: '自定义 Prompt', icon: '✏️', description: '自己编写分析指令', prompt: '' },
];

export const CRON_FREQ_OPTIONS = [
  { label: '每天', value: 'daily' },
  { label: '每周一', value: 'weekly-mon' },
  { label: '每周日', value: 'weekly-sun' },
  { label: '每月 1 日', value: 'monthly' },
  { label: '自定义', value: 'custom' },
];

export function freqToCron(freq: string, time: string): string {
  const [h, m] = time.split(':');
  switch (freq) {
    case 'daily': return `${m} ${h} * * *`;
    case 'weekly-mon': return `${m} ${h} * * 1`;
    case 'weekly-sun': return `${m} ${h} * * 0`;
    case 'monthly': return `${m} ${h} 1 * *`;
    default: return `${m} ${h} * * *`;
  }
}

// ═══ 工具函数 ═══

export function parseConfig(cfg: string): Record<string, unknown> {
  try { return JSON.parse(cfg); } catch { return {}; }
}

/** 相对时间格式化 */
export function timeAgo(date: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

/** 耗时格式化 */
export function formatDuration(ms: number | null): string {
  if (ms == null) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** 执行状态配置 */
export const EXEC_STATUS_CONFIG = {
  success: { label: '成功', cls: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30', badgeCls: 'bg-emerald-50 text-emerald-600' },
  error: { label: '失败', cls: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/30', badgeCls: 'bg-red-50 text-red-500' },
  skipped: { label: '跳过', cls: 'text-muted-foreground/50', bg: 'bg-muted', badgeCls: 'bg-muted text-muted-foreground' },
} as const;

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/**
 * 将 cron 表达式转为中文描述
 * 支持常见格式，无法识别时返回 null
 */
export function describeCron(expr: string): string | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [min, hour, dom, mon, dow] = parts;

  // 每分钟
  if (expr === '* * * * *') return '每分钟执行';

  // 每小时
  if (min !== '*' && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
    return `每小时第 ${min} 分钟执行`;
  }

  // 每天固定时间
  if (min !== '*' && hour !== '*' && dom === '*' && mon === '*' && dow === '*') {
    return `每天 ${hour.padStart(2, '0')}:${min.padStart(2, '0')} 执行`;
  }

  // 每周X固定时间
  if (min !== '*' && hour !== '*' && dom === '*' && mon === '*' && dow !== '*') {
    const dayNames = dow.split(',').map(d => {
      const n = parseInt(d.replace('0', '7'), 10);
      return isNaN(n) ? d : `周${WEEKDAYS[n] || d}`;
    });
    return `每${dayNames.join('、')} ${hour.padStart(2, '0')}:${min.padStart(2, '0')} 执行`;
  }

  // 每月X号固定时间
  if (min !== '*' && hour !== '*' && dom !== '*' && mon === '*' && dow === '*') {
    return `每月 ${dom} 日 ${hour.padStart(2, '0')}:${min.padStart(2, '0')} 执行`;
  }

  return null;
}

export async function fetchWebhooks(): Promise<WH[]> {
  try {
    const settings = await api.get<Record<string, string>>('/settings/NOTIFY');
    if (settings?.webhooks) {
      const parsed = JSON.parse(settings.webhooks);
      if (Array.isArray(parsed)) return parsed.map((w: WH) => ({ name: w.name, channel: w.channel }));
    }
  } catch { /* noop */ }
  return [];
}

export async function fetchModels(): Promise<AIModel[]> {
  try {
    const list = await api.get<Array<{ provider: string; label: string; models: Array<{ id: string; name: string }> }>>('/settings/ai/all-models');
    const out: AIModel[] = [];
    for (const g of list) for (const m of g.models) out.push({ id: m.id, name: m.name, providerLabel: g.label });
    return out;
  } catch { return []; }
}
