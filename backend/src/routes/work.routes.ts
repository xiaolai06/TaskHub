import { Router, Request, Response } from 'express';
import * as workService from '../services/work.service';
import { success, error } from '../utils/response';

const router = Router();

// GET /timer/active — 获取所有活跃计时器
router.get('/timer/active', async (req: Request, res: Response) => {
  try {
    const timers = await workService.getActiveTimer(req.userId!);
    success(res, timers);
  } catch (err) { error(res, 'INTERNAL_ERROR', '获取失败', 500); }
});

// POST /timer/start — 开始计时
router.post('/timer/start', async (req: Request, res: Response) => {
  try {
    const timer = await workService.startTimer(req.userId!, req.body);
    success(res, timer, undefined, 201);
  } catch (err) { error(res, 'INTERNAL_ERROR', '开始失败', 500); }
});

// POST /timer/:id/pause — 暂停
router.post('/timer/:id/pause', async (req: Request, res: Response) => {
  try {
    const timer = await workService.pauseTimer(req.userId!, String(req.params.id));
    if (!timer) { error(res, 'NOT_FOUND', '计时器不存在', 404); return; }
    success(res, timer);
  } catch (err) { error(res, 'INTERNAL_ERROR', '暂停失败', 500); }
});

// POST /timer/:id/resume — 继续
router.post('/timer/:id/resume', async (req: Request, res: Response) => {
  try {
    const timer = await workService.resumeTimer(req.userId!, String(req.params.id));
    if (!timer) { error(res, 'NOT_FOUND', '计时器不存在', 404); return; }
    success(res, timer);
  } catch (err) { error(res, 'INTERNAL_ERROR', '继续失败', 500); }
});

// POST /timer/:id/stop — 停止并记录工时
router.post('/timer/:id/stop', async (req: Request, res: Response) => {
  try {
    const timer = await workService.stopTimer(req.userId!, String(req.params.id));
    if (!timer) { error(res, 'NOT_FOUND', '计时器不存在', 404); return; }
    success(res, timer);
  } catch (err) { error(res, 'INTERNAL_ERROR', '停止失败', 500); }
});

// GET /entries/today — 今日工时记录
router.get('/entries/today', async (req: Request, res: Response) => {
  try {
    const entries = await workService.getTodayEntries(req.userId!);
    success(res, entries);
  } catch (err) { error(res, 'INTERNAL_ERROR', '获取失败', 500); }
});

// GET /todos — 今日待办列表
router.get('/todos', async (req: Request, res: Response) => {
  try {
    const todos = await workService.getTodayTodo(req.userId!);
    success(res, todos);
  } catch (err) { error(res, 'INTERNAL_ERROR', '获取失败', 500); }
});

// POST /todos — 添加待办
router.post('/todos', async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) { error(res, 'VALIDATION_ERROR', '内容不能为空', 400); return; }
    const todo = await workService.addTodo(req.userId!, content.trim());
    success(res, todo, undefined, 201);
  } catch (err) { error(res, 'INTERNAL_ERROR', '添加失败', 500); }
});

// PATCH /todos/:id — 切换完成
router.patch('/todos/:id', async (req: Request, res: Response) => {
  try {
    const todo = await workService.toggleTodo(req.userId!, String(req.params.id));
    if (!todo) { error(res, 'NOT_FOUND', '待办不存在', 404); return; }
    success(res, todo);
  } catch (err) { error(res, 'INTERNAL_ERROR', '切换失败', 500); }
});

// DELETE /todos/:id — 删除待办
router.delete('/todos/:id', async (req: Request, res: Response) => {
  try {
    await workService.removeTodo(req.userId!, String(req.params.id));
    success(res, { deleted: true });
  } catch (err) { error(res, 'INTERNAL_ERROR', '删除失败', 500); }
});

export default router;
