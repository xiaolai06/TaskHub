import { loadPrompt } from '../utils/prompt-loader';

type PromptKey = 'default' | 'create' | 'analyze' | 'schedule' | 'search';

/** 根据用户消息关键词选择适合的系统提示 */
export function selectSystemPrompt(userMessage: string, hasApiKey: boolean): string {
  const msg = userMessage.toLowerCase();

  if (!hasApiKey) {
    return '你是 TaskFlow+ 智能助手。当前未配置 AI API Key，使用 Mock 模式。';
  }

  // 创建类：创建/添加/新建/记录
  if (/创建|新建|添加|加入|加个|建个|帮我记|记录|创建项目|创建任务|创建客户/.test(msg)) {
    return loadPrompt('system-create.txt') || loadPrompt('system-default.txt');
  }

  // 分析类：分析/怎么样/评估/健康度/利润/排名/报告
  if (/分析|怎么样|评估|健康|利润|排名|报告|周报|总结/.test(msg)) {
    return loadPrompt('system-analyze.txt') || loadPrompt('system-default.txt');
  }

  // 排期类：排期/安排/计划/什么时候/时间线/甘特
  if (/排期|安排|计划|什么时候|时间线|甘特|下周/.test(msg)) {
    return loadPrompt('system-schedule.txt') || loadPrompt('system-default.txt');
  }

  // 搜索类：搜索/查一下/最新/趋势/行情/行业/竞品/合理
  if (/搜索|查一下|最新|趋势|行业|竞品|行情|报价.*合理/.test(msg)) {
    return loadPrompt('system-search.txt') || loadPrompt('system-default.txt');
  }

  // 默认
  return loadPrompt('system-default.txt');
}
