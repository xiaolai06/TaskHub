import { Router } from 'express';
import * as conversationService from '../services/conversation.service';
import { success } from '../utils/response';

const router = Router();

// GET /conversations - 获取对话历史
router.get('/conversations', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const history = await conversationService.getHistory(req.userId!, limit);
    success(res, history);
  } catch (err) { next(err); }
});

// GET /conversations/weekly - 获取本周对话（n8n 周报/记忆总结用）
router.get('/conversations/weekly', async (req, res, next) => {
  try {
    const weeksAgo = parseInt(req.query.weeksAgo as string) || 0;
    const result = await conversationService.getWeeklyConversations(req.userId!, weeksAgo);
    success(res, result);
  } catch (err) { next(err); }
});

// GET /conversations/:sessionId - 获取会话详情
router.get('/conversations/:sessionId', async (req, res, next) => {
  try {
    const messages = await conversationService.getSession(req.userId!, req.params.sessionId);
    success(res, messages);
  } catch (err) { next(err); }
});

// DELETE /conversations/:sessionId - 删除会话
router.delete('/conversations/:sessionId', async (req, res, next) => {
  try {
    await conversationService.deleteSession(req.userId!, req.params.sessionId);
    success(res, null, '删除成功');
  } catch (err) { next(err); }
});

export default router;
