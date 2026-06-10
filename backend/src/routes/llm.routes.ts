import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { validate } from '../middleware/validate';
import { chatSchema } from '../validators/llm.schema';
import { AIService } from '../services/ai.service';
import { success } from '../utils/response';
import { getAllTools } from '../ai/tools/registry';
import { selectSystemPrompt } from '../ai/prompt-selector';
import OpenAI from 'openai';

const router = Router();

// ═══ POST /chat/stream — SSE 流式对话 ═══
router.post('/chat/stream', validate(chatSchema), async (req: Request, res: Response) => {
  try {
    const { message, sessionId, model, provider } = req.body;

    // SSE 响应头
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });

    function send(event: unknown) { res.write(`data: ${JSON.stringify(event)}\n\n`); }

    // 初始化 AI（如果前端指定了供应商，使用指定的；否则用默认的）
    const ai = new AIService(req.userId!);
    const initialized = await ai.init(provider);
    const tools = getAllTools();
    ai.registerTools(tools);

    // 检测供应商是否匹配（前端请求的 vs 实际使用的）
    const resolvedProvider = ai.getProvider();
    if (provider && resolvedProvider && provider !== resolvedProvider) {
      send({ type: 'text', content: `⚠️ 供应商 "${provider}" 未配置，已自动切换到 "${resolvedProvider}"。\n请在设置页面添加该供应商的 API Key。\n\n` });
    }

    // 系统提示（根据用户消息自动选择）
    const basePrompt = selectSystemPrompt(message, initialized);
    const toolListHint = tools.map(t => `- \`${t.name}\`: ${t.description}`).join('\n');

    // 读取用户记忆注入上下文
    const memories = await prisma.userMemory.findMany({
      where: { userId: req.userId! },
      orderBy: { confidence: 'desc' },
      take: 20,
      select: { category: true, key: true, value: true, confidence: true },
    });
    const memoryHint = memories.length > 0
      ? `\n\n## 用户记忆（你已了解的用户偏好和业务知识）\n${memories.map(m => `- [${m.category}] ${m.key}: ${m.value}`).join('\n')}\n在回答时参考这些记忆，让回复更个性化。`
      : '';

    // 读取工具权限设置，注入不同的行为指令
    const permSetting = await prisma.setting.findFirst({
      where: { userId: req.userId!, category: 'AI', key: 'tool_permission' },
    });
    const toolPerm = permSetting?.value || 'auto';
    const permHint = toolPerm === 'confirm'
      ? `\n\n## 写操作规则\n当用户要求创建、修改、删除数据时，先用文字说明你将要执行的操作（列出关键字段），然后询问用户"确认执行吗？"。只有当用户回复"确认""执行""是""好"等肯定词时，才调用工具执行。不要在用户确认前调用任何写操作工具。`
      : `\n\n## 写操作规则\n当用户要求创建、修改、删除数据时，直接调用对应的工具执行。不要询问确认，不要只用文字描述。工具是唯一能写入数据的方式。`;

    const systemPrompt = `${basePrompt}${memoryHint}${permHint}\n\n## 可用工具（${tools.length}个）\n${toolListHint}\n\n## 时间说明\n当用户提到"今天"、"明天"、"下周"等相对时间时，必须先调用 get_current_time 工具获取准确日期，再进行计算。不要猜测日期。`;

    // 构建 messages 数组，加载最近对话历史保持上下文连贯
    const sid = sessionId || 'default';
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    messages.push({ role: 'system', content: systemPrompt });

    // 从数据库加载该会话最近 10 条消息（5 轮对话）
    const history = await prisma.conversation.findMany({
      where: { userId: req.userId!, sessionId: sid },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { role: true, content: true },
    });

    // 按时间正序排列（数据库是倒序取的）
    history.reverse();
    for (const h of history) {
      messages.push({ role: h.role as 'user' | 'assistant', content: h.content });
    }

    // 追加当前新消息
    messages.push({ role: 'user', content: message });

    // 保存用户消息
    await prisma.conversation.create({ data: { userId: req.userId!, sessionId: sid, role: 'user', content: message } });

    // 流式对话
    let fullText = '';
    const toolContext: string[] = [];
    for await (const event of ai.chat({ messages, model })) {
      if (!res.destroyed) send(event);
      if (event.type === 'text') fullText += event.content;
      if (event.type === 'tool_call') toolContext.push(`🔧 ${event.name}(${JSON.stringify(event.args).slice(0, 200)})`);
      if (event.type === 'tool_result') toolContext.push(`✅ ${event.name}: ${JSON.stringify(event.result).slice(0, 200)}`);
    }

    // 保存 AI 回复（含工具上下文摘要）
    if (fullText || toolContext.length > 0) {
      const content = toolContext.length > 0
        ? `${fullText}\n\n[工具调用]\n${toolContext.join('\n')}`
        : fullText;
      await prisma.conversation.create({ data: { userId: req.userId!, sessionId: sid, role: 'assistant', content } });
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
    ai.registerTools(getAllTools());

    // 检测供应商匹配
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

// ═══ GET /conversations — 会话列表 ═══
router.get('/conversations', async (req: Request, res: Response, next) => {
  try {
    const sessions = await prisma.conversation.groupBy({
      by: ['sessionId'], where: { userId: req.userId! }, _count: true,
      _min: { createdAt: true }, _max: { createdAt: true },
    });
    success(res, sessions.map(s => ({ sessionId: s.sessionId, messageCount: s._count, lastMessage: s._max.createdAt })));
  } catch (err) { next(err); }
});

// ═══ GET /conversations/weekly — 本周对话（n8n 周报/记忆总结用） ═══
router.get('/conversations/weekly', async (req: Request, res: Response, next) => {
  try {
    const weeksAgo = parseInt(req.query.weeksAgo as string) || 0;
    const now = new Date();
    const dayOfWeek = now.getDay() || 7;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek + 1 - weeksAgo * 7);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const conversations = await prisma.conversation.findMany({
      where: {
        userId: req.userId!,
        createdAt: { gte: startOfWeek, lte: endOfWeek },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, content: true, sessionId: true, createdAt: true },
    });

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

// ═══ GET /conversations/:sessionId — 会话消息 ═══
router.get('/conversations/:sessionId', async (req: Request, res: Response, next) => {
  try {
    const msgs = await prisma.conversation.findMany({
      where: { userId: req.userId!, sessionId: String(req.params.sessionId) },
      orderBy: { createdAt: 'asc' }, select: { id: true, role: true, content: true, createdAt: true },
    });
    success(res, msgs);
  } catch (err) { next(err); }
});

// ═══ DELETE /conversations/:sessionId — 删除会话 ═══
router.delete('/conversations/:sessionId', async (req: Request, res: Response, next) => {
  try {
    await prisma.conversation.deleteMany({ where: { userId: req.userId!, sessionId: String(req.params.sessionId) } });
    success(res, null, '会话已删除');
  } catch (err) { next(err); }
});

// ═══ GET /tools — 获取工具列表 ═══
router.get('/tools', async (_req: Request, res: Response) => {
  const tools = getAllTools().map(t => ({ name: t.name, description: t.description, category: t.category, access: t.access }));
  success(res, { total: tools.length, tools });
});

export default router;
