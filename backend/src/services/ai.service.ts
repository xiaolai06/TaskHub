import OpenAI from 'openai';
import { prisma } from '../server';
import { decrypt } from './encryption.service';
import { getBaseUrl as getDynamicBaseUrl } from './setting.service';
import type { ToolDefinition } from '../ai/tools/types';

// ═══ 类型 ═══

export type StreamEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; name: string; result: unknown }
  | { type: 'done' };

interface AIConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  powerfulModel: string;
}

// ═══ Token 估算 ═══

function estimateTokens(text: string): number {
  return Math.ceil(text.length * 0.5); // 中文约 0.5 token/字
}

function countMessagesTokens(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]): number {
  return messages.reduce((t, m) => t + estimateTokens(typeof m.content === 'string' ? m.content : JSON.stringify(m.content || '')) + 10, 0);
}

// ═══ 工具结果截断 ═══

function truncateResult(result: unknown, maxChars = 500): unknown {
  const str = JSON.stringify(result);
  if (str.length <= maxChars) return result;
  if (Array.isArray(result)) {
    return { data: result.slice(0, 5), total: result.length, showing: 5, note: `共 ${result.length} 条，显示前 5 条` };
  }
  return result;
}

// ═══ 裁剪 messages ═══

function trimMessages(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[], maxTokens = 4000): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const current = countMessagesTokens(messages);
  if (current <= maxTokens) return messages;

  const systemMsgs = messages.filter(m => m.role === 'system');
  const nonSystem = messages.filter(m => m.role !== 'system');
  const trimmed = nonSystem.slice(-8); // 保留最近 4 轮（8 条）
  return [...systemMsgs, ...trimmed];
}

// ═══ AIService 类 ═══

export class AIService {
  private client: OpenAI | null = null;
  private config: AIConfig | null = null;
  private userId: string;
  private tools: ToolDefinition[] = [];
  private toolMap: Map<string, ToolDefinition> = new Map();

  constructor(userId: string) {
    this.userId = userId;
  }

  /** 从 Setting 表读取 AI 配置 */
  async init(): Promise<boolean> {
    const settings = await prisma.setting.findMany({
      where: { userId: this.userId, category: 'AI' },
    });
    const get = (key: string) => settings.find(s => s.key === key)?.value;
    const provider = get('provider');
    const apiKeyEnc = get('api_key');
    if (!provider || !apiKeyEnc) return false;

    let apiKey: string;
    try { apiKey = decrypt(apiKeyEnc); } catch { return false; }

    // 动态获取 baseUrl（从用户配置的 AI_PROVIDER 或预置列表）
    let baseUrl = get('base_url');
    if (!baseUrl) {
      baseUrl = await getDynamicBaseUrl(this.userId, provider);
    }

    this.config = {
      provider,
      apiKey,
      baseUrl,
      model: get('default_model') || 'deepseek-chat',
      powerfulModel: get('powerful_model') || get('default_model') || 'deepseek-chat',
    };

    this.client = new OpenAI({ apiKey, baseURL: this.config.baseUrl });
    return true;
  }

  /** 注册工具 */
  registerTools(tools: ToolDefinition[]): void {
    this.tools = tools;
    this.toolMap.clear();
    for (const t of tools) this.toolMap.set(t.name, t);
  }

  /** 流式对话 */
  async *chat(options: {
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
    model?: string;
  }): AsyncGenerator<StreamEvent> {
    // Mock 模式
    if (!this.client || !this.config) {
      yield* this.mockChat(options.messages);
      return;
    }

    try {
      const model = options.model || this.config.model;
      const tools = this.tools.map(t => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.parameters } }));
      let messages = trimMessages([...options.messages]);
    let maxLoops = 5;

    while (maxLoops > 0) {
      maxLoops--;

      const stream = await this.client.chat.completions.create({
        model, messages, tools, stream: true, temperature: 0.7, max_tokens: 2048,
      }) as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;

      let fullContent = '';
      const toolCalls: Array<{ id: string; type: string; function: { name: string; arguments: string } }> = [];

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) { fullContent += delta.content; yield { type: 'text', content: delta.content }; }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCalls[idx]) toolCalls[idx] = { id: '', type: 'function', function: { name: '', arguments: '' } };
            if (tc.id) toolCalls[idx].id = tc.id;
            if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
            if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
          }
        }
      }

      if (toolCalls.length === 0) { yield { type: 'done' }; return; }

      // 加入 assistant 消息
      messages.push({ role: 'assistant', content: fullContent || null, tool_calls: toolCalls as any });

      // 执行工具
      for (const tc of toolCalls) {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.function.arguments); } catch { /* ignore */ }
        yield { type: 'tool_call', name: tc.function.name, args };

        const tool = this.toolMap.get(tc.function.name);
        let result: unknown;
        if (tool) {
          try { result = await tool.handler(args, this.userId); }
          catch (err) { result = { error: err instanceof Error ? err.message : '工具执行失败' }; }
        } else {
          result = { error: `未知工具: ${tc.function.name}` };
        }
        const truncated = truncateResult(result);
        yield { type: 'tool_result', name: tc.function.name, result: truncated };

        messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(truncated) });
      }
    }

    yield { type: 'done' };
  } catch (apiErr: unknown) {
    yield { type: 'text', content: `AI 调用失败: ${apiErr instanceof Error ? apiErr.message : '未知错误'}。请检查 API Key 是否正确。` };
    yield { type: 'done' };
  }
  }

  /** Mock 对话 */
  private async *mockChat(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]): AsyncGenerator<StreamEvent> {
    const lastMsg = messages[messages.length - 1]?.content || '';
    const text = typeof lastMsg === 'string' ? lastMsg : '';

    yield { type: 'text', content: '（Mock 模式）AI 未配置。' };

    try {
      if (text.includes('任务') || text.includes('今天')) {
        const tasks = await prisma.task.findMany({
          where: { project: { ownerId: this.userId }, status: { not: 'DONE' } },
          take: 5, orderBy: { priority: 'asc' },
        });
        for (const t of tasks) yield { type: 'text', content: `\n· ${t.title} (${t.priority})\n` };
      } else if (text.includes('项目')) {
        const projects = await prisma.project.findMany({
          where: { ownerId: this.userId, status: 'ACTIVE' },
          take: 3,
        });
        for (const p of projects) yield { type: 'text', content: `\n· ${p.name} (${p.status})\n` };
      } else {
        yield { type: 'text', content: '\n请在设置页面配置 AI API Key。' };
      }
    } catch { yield { type: 'text', content: '\n查询失败，请稍后重试。' }; }

    yield { type: 'done' };
  }

  /** 测试连接 */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.client || !this.config) return { success: false, message: '未配置 AI' };
    try {
      await this.client.chat.completions.create({
        model: this.config.model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5,
      });
      return { success: true, message: `连接成功 (${this.config.model})` };
    } catch (err) {
      return { success: false, message: `连接失败: ${err instanceof Error ? err.message : '未知错误'}` };
    }
  }
}
