import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { validate } from '../middleware/validate';
import { chatSchema } from '../validators/llm.schema';
import { AIService } from '../services/ai.service';
import { success } from '../utils/response';
import { getAllTools, getTool } from '../ai/tools/registry';
import { decrypt } from '../services/encryption.service';
import OpenAI from 'openai';

const router = Router();

// ═══ POST /chat/stream — SSE 流式对话 ═══
router.post('/chat/stream', validate(chatSchema), async (req: Request, res: Response) => {
  try {
    const { message, sessionId } = req.body;

    // SSE 响应头
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });

    function send(event: unknown) { res.write(`data: ${JSON.stringify(event)}\n\n`); }

    // 初始化 AI
    const ai = new AIService(req.userId!);
    const initialized = await ai.init();
    ai.registerTools(getAllTools());

    // 获取或创建会话
    const sid = sessionId || 'default';
    const conv = await prisma.conversation.findMany({
      where: { userId: req.userId!, sessionId: sid },
      orderBy: { createdAt: 'desc' }, take: 6,
    });

    // 构建 messages
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // 系统提示
    const systemPrompt = initialized
      ? `你是 TaskFlow+ 智能助手，帮助一人公司老板管理项目、任务、客户和财务。\n规则：\n1. 用户问到具体数据时，先调用工具查询\n2. 执行写操作前先确认\n3. 回复简洁，用中文\n4. 数据用具体数字，有风险主动提醒`
      : `你是 TaskFlow+ 智能助手。当前未配置 AI API Key，使用 Mock 模式。`;
    messages.push({ role: 'system', content: systemPrompt });

    // 历史对话
    for (const h of conv.reverse()) {
      if (h.role === 'user') messages.push({ role: 'user', content: h.content });
      else if (h.role === 'assistant') messages.push({ role: 'assistant', content: h.content });
    }

    // 新消息
    messages.push({ role: 'user', content: message });

    // 保存用户消息
    await prisma.conversation.create({ data: { userId: req.userId!, sessionId: sid, role: 'user', content: message } });

    // 流式对话
    let fullText = '';
    for await (const event of ai.chat({ messages })) {
      send(event);
      if (event.type === 'text') fullText += event.content;
    }

    // 保存 AI 回复
    if (fullText) {
      await prisma.conversation.create({ data: { userId: req.userId!, sessionId: sid, role: 'assistant', content: fullText } });
    }

    send('[DONE]');
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: err instanceof Error ? err.message : '对话出错' })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// ═══ POST /chat — 非流式对话（简化版，用于测试） ═══
router.post('/chat', validate(chatSchema), async (req: Request, res: Response, next) => {
  try {
    const ai = new AIService(req.userId!);
    await ai.init();
    ai.registerTools(getAllTools());
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: '你是 TaskFlow+ 智能助手。回复简洁，用中文。' },
      { role: 'user', content: req.body.message },
    ];
    let fullText = '';
    for await (const event of ai.chat({ messages })) {
      if (event.type === 'text') fullText += event.content;
    }
    success(res, { reply: fullText });
  } catch (err) { next(err); }
});

// ═══ GET /conversations — 会话列表 ═══
router.get('/conversations', async (req: Request, res: Response, next) => {
  try {
    const sessions = await prisma.conversation.groupBy({
      by: ['sessionId'],
      where: { userId: req.userId! },
      _count: true,
      _min: { createdAt: true },
      _max: { createdAt: true },
    });
    const result = sessions.map(s => ({
      sessionId: s.sessionId,
      messageCount: s._count,
      createdAt: s._min.createdAt,
      lastMessage: s._max.createdAt,
    }));
    success(res, result);
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
    const messages = await prisma.conversation.findMany({
      where: { userId: req.userId!, sessionId: String(req.params.sessionId) },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, content: true, createdAt: true },
    });
    success(res, messages);
  } catch (err) { next(err); }
});

// ═══ DELETE /conversations/:sessionId — 删除会话 ═══
router.delete('/conversations/:sessionId', async (req: Request, res: Response, next) => {
  try {
    await prisma.conversation.deleteMany({ where: { userId: req.userId!, sessionId: String(req.params.sessionId) } });
    success(res, null, '会话已删除');
  } catch (err) { next(err); }
});

// ═══ GET /tools — 获取工具列表（调试用） ═══
router.get('/tools', async (_req: Request, res: Response) => {
  const tools = getAllTools().map(t => ({ name: t.name, description: t.description, category: t.category, access: t.access }));
  success(res, tools);
});

export default router;
