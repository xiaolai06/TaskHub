import { Router, Request, Response, NextFunction } from 'express';
import * as workService from '../services/work.service';
import { success, error } from '../utils/response';
import { validate } from '../middleware/validate';
import { startTimerSchema, addTodoSchema } from '../validators/work.schema';

const router = Router();

// GET /timer/active — 获取所有活跃计时器
router.get('/timer/active', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const timers = await workService.getActiveTimer(req.userId!);
    success(res, timers);
  } catch (err) { next(err); }
});

// POST /timer/start — 开始计时
router.post('/timer/start', validate(startTimerSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const timer = await workService.startTimer(req.userId!, req.body);
    success(res, timer, undefined, 201);
  } catch (err) { next(err); }
});

// POST /timer/:id/pause — 暂停
router.post('/timer/:id/pause', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const timer = await workService.pauseTimer(req.userId!, String(req.params.id));
    if (!timer) { error(res, 'NOT_FOUND', '计时器不存在', 404); return; }
    success(res, timer);
  } catch (err) { next(err); }
});

// POST /timer/:id/resume — 继续
router.post('/timer/:id/resume', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const timer = await workService.resumeTimer(req.userId!, String(req.params.id));
    if (!timer) { error(res, 'NOT_FOUND', '计时器不存在', 404); return; }
    success(res, timer);
  } catch (err) { next(err); }
});

// POST /timer/:id/stop — 停止并记录工时
router.post('/timer/:id/stop', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const timer = await workService.stopTimer(req.userId!, String(req.params.id));
    if (!timer) { error(res, 'NOT_FOUND', '计时器不存在', 404); return; }
    success(res, timer);
  } catch (err) { next(err); }
});

// GET /entries/today — 今日工时记录
router.get('/entries/today', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entries = await workService.getTodayEntries(req.userId!);
    success(res, entries);
  } catch (err) { next(err); }
});

// GET /todos — 今日待办列表
router.get('/todos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const todos = await workService.getTodayTodo(req.userId!);
    success(res, todos);
  } catch (err) { next(err); }
});

// POST /todos — 添加待办
router.post('/todos', validate(addTodoSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const todo = await workService.addTodo(req.userId!, req.body.content.trim());
    success(res, todo, undefined, 201);
  } catch (err) { next(err); }
});

// PATCH /todos/:id — 切换完成
router.patch('/todos/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const todo = await workService.toggleTodo(req.userId!, String(req.params.id));
    if (!todo) { error(res, 'NOT_FOUND', '待办不存在', 404); return; }
    success(res, todo);
  } catch (err) { next(err); }
});

// DELETE /todos/:id — 删除待办
router.delete('/todos/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await workService.removeTodo(req.userId!, String(req.params.id));
    success(res, { deleted: true });
  } catch (err) { next(err); }
});

export default router;
