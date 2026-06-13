import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { validate } from '../middleware/validate';
import { chatSchema, updateSessionSchema } from '../validators/llm.schema';
import { AIService } from '../services/ai.service';
import { success } from '../utils/response';
import { getAllTools } from '../ai/tools/registry';
import { selectRelevantTools } from '../ai/tools/tool-router';
import { selectSystemPrompt } from '../ai/prompt-selector';
import { getProxyStatus } from '../services/proxy-config';
import { fetchWithTimeout } from '../ai/tools/fetch-with-timeout';
import * as convService from '../services/conversation.service';
import OpenAI from 'openai';

const router = Router();

// ═══ 模块级缓存（避免每次请求查库/请求远程）═══

interface CacheEntry<T> { data: T; ts: number; }
const memCache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟

function getCached<T>(key: string): T | null {
  const e = memCache.get(key);
  if (!e || Date.now() - e.ts > CACHE_TTL) return null;
  return e.data as T;
}
function setCache<T>(key: string, data: T): void {
  memCache.set(key, { data, ts: Date.now() });
}

interface MemoryItem { category: string; key: string; value: string; confidence: number; }

// 缓存记忆查询
async function getCachedMemories(userId: string): Promise<MemoryItem[]> {
  const key = `mem:${userId}`;
  const cached = getCached<MemoryItem[]>(key);
  if (cached) return cached;
  const data = await prisma.userMemory.findMany({
    where: { userId },
    orderBy: { confidence: 'desc' },
    take: 30,
    select: { category: true, key: true, value: true, confidence: true },
  });
  setCache(key, data);
  return data;
}

// 缓存工具权限设置
async function getCachedToolPermission(userId: string): Promise<string> {
  const key = `perm:${userId}`;
  const cached = getCached<string>(key);
  if (cached) return cached;
  const row = await prisma.setting.findFirst({
    where: { userId, category: 'AI', key: 'tool_permission' },
  });
  const value = row?.value || 'auto';
  setCache(key, value);
  return value;
}

// 缓存 SearXNG 健康检查
async function getCachedSearXNGStatus(userId: string): Promise<{ configured: boolean; available: boolean }> {
  const key = `searxng:${userId}`;
  const cached = getCached<{ configured: boolean; available: boolean }>(key);
  if (cached) return cached;
  const result = { configured: false, available: false };
  try {
    const row = await prisma.setting.findFirst({
      where: { userId, category: 'SEARCH', key: 'searxng_url' },
    });
    const url = row?.value?.trim();
    if (url) {
      result.configured = true;
      try {
        const resp = await fetchWithTimeout(`${url.replace(/\/+$/, '')}/search?q=ping&format=json`, {
          headers: { 'Accept': 'application/json' },
        }, 8_000);
        result.available = resp.ok;
      } catch { /* unreachable */ }
    }
  } catch { /* ignore */ }
  setCache(key, result);
  return result;
}

// ═══ POST /chat/stream — SSE 流式对话 ═══
router.post('/chat/stream', validate(chatSchema), async (req: Request, res: Response) => {
  try {
    const { message, sessionId, conversationSessionId, model, provider } = req.body;

    // 确定会话：优先用 conversationSessionId，否则用 sessionId（兼容旧逻辑）
    let sid = sessionId || 'default';
    let convSessionId: string | undefined = conversationSessionId;

    // 如果没传 conversationSessionId，确保默认会话存在
    if (!convSessionId && sid === 'default') {
      const defaultSession = await convService.ensureDefaultSession(req.userId!);
      convSessionId = defaultSession.id;
    }

    // SSE 响应头
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });

    function send(event: unknown) { res.write(`data: ${JSON.stringify(event)}\n\n`); }

    // 初始化 AI
    const ai = new AIService(req.userId!);
    const initialized = await ai.init(provider);
    const allTools = getAllTools();

    // 动态工具加载：根据用户消息只加载相关工具，减少 token 浪费
    const { tools, matchedGroups, totalTools } = selectRelevantTools(message, allTools);
    console.log(`[ToolRouter] 消息: "${message.slice(0, 30)}..." → 匹配组: [${matchedGroups.join(', ')}] → 加载 ${totalTools}/${allTools.length} 个工具`);

    ai.registerTools(tools);

    // 检测供应商是否匹配
    const resolvedProvider = ai.getProvider();
    if (provider && resolvedProvider && provider !== resolvedProvider) {
      send({ type: 'text', content: `⚠️ 供应商 "${provider}" 未配置，已自动切换到 "${resolvedProvider}"。\n请在设置页面添加该供应商的 API Key。\n\n` });
    }

    // 系统提示
    const basePrompt = selectSystemPrompt(message, initialized);
    const toolListHint = tools.map(t => `- \`${t.name}\`: ${t.description.split('\n')[0]}`).join('\n');

    // 读取用户记忆注入上下文（缓存 5 分钟，避免每次查库）
    const allMemories = await getCachedMemories(req.userId!);

    // 记忆分层过滤：核心记忆始终注入，事实/事件记忆按关键词匹配
    const msgLower = message.toLowerCase();
    const isCore = (m: { category: string }) => m.category === 'PREFERENCE' || m.category === 'RULE';
    const isRelated = (m: { key: string; value: string }) => {
      const keywords = (m.key + ' ' + m.value)
        .split(/[,，、\s]+/)
        .filter(w => w.length >= 2)
        .map(w => w.toLowerCase());
      return keywords.some(kw => msgLower.includes(kw));
    };

    const relevantMemories = allMemories
      .filter(m => isCore(m) || isRelated(m))
      .slice(0, 8)
      .map(m => `- [${m.category}] ${m.key}: ${m.value.slice(0, 50)}`);

    const memoryHint = relevantMemories.length > 0
      ? `\n\n## 用户记忆（你已了解的用户偏好和业务知识）\n${relevantMemories.join('\n')}\n在回答时参考这些记忆，让回复更个性化。`
      : '';

    console.log(`[Memory] 总记忆: ${allMemories.length}条, 相关: ${relevantMemories.length}条`);

    // 读取工具权限设置（缓存 5 分钟）
    const toolPerm = await getCachedToolPermission(req.userId!);
    const permHint = toolPerm === 'confirm'
      ? `\n\n## 写操作规则\n当用户要求创建、修改、删除数据时，先用文字说明你将要执行的操作（列出关键字段），然后询问用户"确认执行吗？"。只有当用户回复"确认""执行""是""好"等肯定词时，才调用工具执行。不要在用户确认前调用任何写操作工具。`
      : `\n\n## 写操作规则\n当用户要求创建、修改、删除数据时，直接调用对应的工具执行。不要询问确认，不要只用文字描述。工具是唯一能写入数据的方式。`;

    // 检测代理状态（含健康检查，结果缓存 5 分钟）
    const proxyStatus = await getProxyStatus(req.userId!);
    console.log(`[Proxy] 聊天时代理状态: available=${proxyStatus.available}, message=${proxyStatus.message}`);

    // 检测 SearXNG 状态（缓存 5 分钟，避免每次聊天都 HTTP 探测）
    const searxngStatus = await getCachedSearXNGStatus(req.userId!);
    console.log(`[SearXNG] 聊天时状态: configured=${searxngStatus.configured}, available=${searxngStatus.available}`);

    // 构建网络环境说明
    const networkLines: string[] = [];
    if (searxngStatus.available) {
      networkLines.push('- ✅ SearXNG 已就绪 → 通用搜索首选 search_searxng（聚合 Google+Bing+百度，质量最高）');
    } else if (searxngStatus.configured) {
      networkLines.push('- ⚠️ SearXNG 已配置但不可用 → 通用搜索降级到其他工具');
    }
    if (proxyStatus.available) {
      networkLines.push(`- ✅ 代理可用: ${proxyStatus.message}`);
      networkLines.push('  search_duckduckgo 和 search_google_news 可通过代理访问');
      if (!searxngStatus.available) {
        networkLines.push('  通用搜索优先用 search_duckduckgo（国际结果更全），中文搜索可用 search_sogou');
      }
    } else {
      networkLines.push(`- ❌ 代理不可用: ${proxyStatus.message}`);
      if (!searxngStatus.available) {
        networkLines.push('  通用搜索用 search_sogou（国内直连免费）');
      }
    }
    const networkEnv = networkLines.join('\n');

    const systemPrompt = `${basePrompt}${memoryHint}${permHint}\n\n## 可用工具（${tools.length}个）\n${toolListHint}\n\n## 时间说明\n当用户提到"今天"、"明天"、"下周"等相对时间时，必须先调用 get_current_time 工具获取准确日期，再进行计算。不要猜测日期。\n\n## 网络环境\n${networkEnv}`;

    // 构建 messages 数组
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    messages.push({ role: 'system', content: systemPrompt });

    // 从数据库加载该会话最近 10 条消息（5 轮对话）
    const historyWhere = convSessionId
      ? { conversationSessionId: convSessionId }
      : { userId: req.userId!, sessionId: sid };
    const history = await prisma.conversation.findMany({
      where: historyWhere,
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { role: true, content: true },
    });

    history.reverse();
    for (const h of history) {
      messages.push({ role: h.role as 'user' | 'assistant', content: h.content });
    }

    // 判断是否是该会话的第一条消息（用于后续生成标题）
    const existingCount = convSessionId
      ? await prisma.conversation.count({ where: { conversationSessionId: convSessionId } })
      : await prisma.conversation.count({ where: { userId: req.userId!, sessionId: sid } });
    const isFirstMessage = existingCount === 0;

    // 追加当前新消息
    messages.push({ role: 'user', content: message });

    // 保存用户消息
    await prisma.conversation.create({
      data: {
        userId: req.userId!,
        sessionId: sid,
        conversationSessionId: convSessionId,
        role: 'user',
        content: message,
      },
    });

    // 流式对话
    let fullText = '';
    for await (const event of ai.chat({ messages, model })) {
      if (!res.destroyed) send(event);
      if (event.type === 'text') fullText += event.content;
    }

    // 保存 AI 回复
    if (fullText) {
      await prisma.conversation.create({
        data: {
          userId: req.userId!,
          sessionId: sid,
          conversationSessionId: convSessionId,
          role: 'assistant',
          content: fullText || '(工具执行完成)',
        },
      });
    }

    // 异步生成标题（第一条消息，不阻塞响应）
    if (isFirstMessage && convSessionId) {
      convService.generateTitle(req.userId!, convSessionId, message).catch(() => {});
    }

    if (!res.destroyed) {
      send('[DONE]');
      res.end();
    }
  } catch (err) {
    if (!res.destroyed) {
      try {
        res.write(`data: ${JSON.stringify({ type: 'error', message: err instanceof Error ? err.message : '对话出错' })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      } catch { /* connection already closed */ }
    }
  }
});

// ═══ POST /chat — 非流式对话 ═══
router.post('/chat', validate(chatSchema), async (req: Request, res: Response, next) => {
  try {
    const ai = new AIService(req.userId!);
    const initialized = await ai.init(req.body.provider);
    // 非流式也使用动态工具路由，节省 token
    const { tools } = selectRelevantTools(req.body.message, getAllTools());
    ai.registerTools(tools);

    const resolvedProvider = ai.getProvider();
    let prefix = '';
    if (req.body.provider && resolvedProvider && req.body.provider !== resolvedProvider) {
      prefix = `⚠️ 供应商 "${req.body.provider}" 未配置，已自动切换到 "${resolvedProvider}"。\n\n`;
    }

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: selectSystemPrompt(req.body.message, initialized) },
      { role: 'user', content: req.body.message },
    ];
    let fullText = '';
    for await (const event of ai.chat({ messages, model: req.body.model })) {
      if (event.type === 'text') fullText += event.content;
    }
    success(res, { reply: prefix + fullText });
  } catch (err) { next(err); }
});

// ═══ GET /conversations — 会话列表（新 API） ═══
router.get('/conversations', async (req: Request, res: Response, next) => {
  try {
    // 确保默认会话存在
    await convService.ensureDefaultSession(req.userId!);
    const sessions = await convService.listSessions(req.userId!);
    success(res, sessions);
  } catch (err) { next(err); }
});

// ═══ POST /conversations — 创建新会话 ═══
router.post('/conversations', async (req: Request, res: Response, next) => {
  try {
    const session = await convService.createSession(req.userId!, req.body?.title);
    success(res, session, '会话已创建', 201);
  } catch (err) { next(err); }
});

// ═══ PATCH /conversations/:id — 更新会话（重命名/置顶） ═══
router.patch('/conversations/:id', validate(updateSessionSchema), async (req: Request, res: Response, next) => {
  try {
    const session = await convService.updateSession(req.userId!, req.params.id as string, req.body);
    success(res, session);
  } catch (err) { next(err); }
});

// ═══ GET /conversations/weekly — 本周对话（n8n 用） ═══
router.get('/conversations/weekly', async (req: Request, res: Response, next) => {
  try {
    const weeksAgo = parseInt(req.query.weeksAgo as string) || 0;
    const conversations = await convService.getWeeklyConversations(req.userId!, weeksAgo);
    const now = new Date();
    const dayOfWeek = now.getDay() || 7;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek + 1 - weeksAgo * 7);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    success(res, {
      conversations,
      period: { start: startOfWeek.toISOString(), end: endOfWeek.toISOString() },
      summary: {
        totalMessages: conversations.length,
        userMessages: conversations.filter(c => c.role === 'user').length,
        assistantMessages: conversations.filter(c => c.role === 'assistant').length,
        sessions: [...new Set(conversations.map(c => c.sessionId))].length,
      },
    });
  } catch (err) { next(err); }
});

// ═══ GET /conversations/:id/messages — 获取会话消息 ═══
router.get('/conversations/:id/messages', async (req: Request, res: Response, next) => {
  try {
    const msgs = await convService.getMessages(req.userId!, req.params.id as string);
    success(res, msgs);
  } catch (err) { next(err); }
});

// ═══ DELETE /conversations/:id — 删除会话 ═══
router.delete('/conversations/:id', async (req: Request, res: Response, next) => {
  try {
    await convService.deleteSession(req.userId!, req.params.id as string);
    success(res, null, '会话已删除');
  } catch (err) { next(err); }
});

// ═══ GET /tools — 获取工具列表 ═══
router.get('/tools', async (_req: Request, res: Response) => {
  const tools = getAllTools().map(t => ({ name: t.name, description: t.description, category: t.category, access: t.access }));
  success(res, { total: tools.length, tools });
});

export default router;
