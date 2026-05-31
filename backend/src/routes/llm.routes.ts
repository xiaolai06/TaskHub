import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { validate } from '../middleware/validate';
import { chatSchema } from '../validators/llm.schema';
import { AIService } from '../services/ai.service';
import { success } from '../utils/response';
import { getAllTools, TOTAL_TOOLS } from '../ai/tools/registry';
import { selectSystemPrompt } from '../ai/prompt-selector';
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
    const tools = getAllTools();
    ai.registerTools(tools);

    // 系统提示（根据用户消息自动选择）
    const basePrompt = selectSystemPrompt(message, initialized);
    const toolListHint = tools.map(t => `- \`${t.name}\`: ${t.description}`).join('\n');
    const systemPrompt = basePrompt + `\n\n## 可用工具（${tools.length}个）\n${toolListHint}`;

    // 构建 messages 数组
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    messages.push({ role: 'system', content: systemPrompt });

    // 获取或创建会话
    const sid = sessionId || 'default';
    const conv = await prisma.conversation.findMany({
      where: { userId: req.userId!, sessionId: sid },
      orderBy: { createdAt: 'desc' }, take: 6,
    });

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

// ═══ POST /chat — 非流式对话 ═══
router.post('/chat', validate(chatSchema), async (req: Request, res: Response, next) => {
  try {
    const ai = new AIService(req.userId!);
    const initialized = await ai.init();
    ai.registerTools(getAllTools());
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: selectSystemPrompt(req.body.message, initialized) },
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
      by: ['sessionId'], where: { userId: req.userId! }, _count: true,
      _min: { createdAt: true }, _max: { createdAt: true },
    });
    success(res, sessions.map(s => ({ sessionId: s.sessionId, messageCount: s._count, lastMessage: s._max.createdAt })));
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
