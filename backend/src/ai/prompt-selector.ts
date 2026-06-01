import fs from 'fs';
import path from 'path';

const PROMPT_DIR = path.resolve(__dirname, '../../prompts');

type PromptKey = 'default' | 'create' | 'analyze' | 'schedule' | 'search';

const promptCache = new Map<string, string>();

function loadPrompt(name: string): string {
  if (promptCache.has(name)) return promptCache.get(name)!;
  try {
    const content = fs.readFileSync(path.join(PROMPT_DIR, `system-${name}.txt`), 'utf-8');
    promptCache.set(name, content);
    return content;
  } catch {
    return '';
  }
}

/** 根据用户消息关键词选择适合的系统提示 */
export function selectSystemPrompt(userMessage: string, hasApiKey: boolean): string {
  const msg = userMessage.toLowerCase();

  if (!hasApiKey) {
    return '你是 TaskFlow+ 智能助手。当前未配置 AI API Key，使用 Mock 模式。';
  }

  // 创建类：创建/添加/新建/记录
  if (/创建|新建|添加|加入|加个|建个|帮我记|记录|创建项目|创建任务|创建客户/.test(msg)) {
    return loadPrompt('create') || loadPrompt('default');
  }

  // 分析类：分析/怎么样/评估/健康度/利润/排名/报告
  if (/分析|怎么样|评估|健康|利润|排名|报告|周报|总结/.test(msg)) {
    return loadPrompt('analyze') || loadPrompt('default');
  }

  // 排期类：排期/安排/计划/什么时候/时间线/甘特
  if (/排期|安排|计划|什么时候|时间线|甘特|下周/.test(msg)) {
    return loadPrompt('schedule') || loadPrompt('default');
  }

  // 搜索类：搜索/查一下/最新/趋势/行情/行业/竞品/合理
  if (/搜索|查一下|最新|趋势|行业|竞品|行情|报价.*合理/.test(msg)) {
    return loadPrompt('search') || loadPrompt('default');
  }

  // 默认
  return loadPrompt('default');
}
