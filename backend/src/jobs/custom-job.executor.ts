import cron from 'node-cron';
import { prisma } from '../server';
import { AIService } from '../services/ai.service';
import * as notificationService from '../services/notification.service';
import * as dashboardService from '../services/dashboard.service';
import { logExecution } from '../utils/job-logger';
import logger from '../utils/logger';

// AI 分析模板 prompt 映射（与前端 AI_TEMPLATES 对应）
const TEMPLATE_PROMPTS: Record<string, string> = {
  'project-progress': '请汇总当前所有项目的进展，包括完成百分比、关键里程碑、风险项和待办事项。用简洁的列表格式呈现。',
  'finance-analysis': '请分析本期的财务数据，包括收入支出趋势、利润情况、成本结构分析，并给出优化建议。',
  'client-status': '请扫描所有客户的跟进状态，包括近期沟通记录、合同到期提醒、待跟进商机，按优先级排序。',
  'task-summary': '请统计本期的任务完成情况，包括完成率、逾期任务、团队成员工作量分布，并给出效率改进建议。',
  'cost-alert': '请检测本期的异常支出情况，分析各项目预算使用率，预警可能超支的项目，并给出控制建议。',
  'goal-progress': '请分析所有经营目标的进展状态，包括各目标完成百分比、是否落后预期、打卡类目标的连续天数、风险目标的改进建议。按紧急程度排序。',
};

function parseCfg(config: string): Record<string, unknown> {
  try { return JSON.parse(config); } catch { return {}; }
}

/** 获取相关数据用于 AI 分析 */
async function gatherAnalysisData(userId: string): Promise<string> {
  const [stats, overdueTasks, recentTasks, recentCosts, goals, recentCheckins] = await Promise.all([
    dashboardService.getStats(userId),
    prisma.task.findMany({
      where: { project: { ownerId: userId }, status: { not: 'DONE' }, dueDate: { lt: new Date() } },
      include: { project: { select: { name: true } } },
      take: 10,
    }),
    prisma.task.findMany({
      where: { project: { ownerId: userId }, updatedAt: { gte: new Date(Date.now() - 7 * 86400000) } },
      include: { project: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 15,
    }),
    prisma.costRecord.findMany({
      where: { project: { ownerId: userId }, date: { gte: new Date(Date.now() - 30 * 86400000) } },
      orderBy: { amount: 'desc' },
      take: 10,
      select: { description: true, amount: true, category: true },
    }),
    // 目标数据（进行中 + 有风险的）
    prisma.goal.findMany({
      where: { userId, status: { in: ['ACTIVE', 'AT_RISK'] } },
      select: {
        title: true, metricType: true, targetValue: true, currentValue: true,
        status: true, startDate: true, endDate: true, unit: true, progressMode: true,
        milestones: { select: { title: true, completed: true } },
      },
      orderBy: { endDate: 'asc' },
      take: 20,
    }),
    // 最近 7 天打卡记录
    prisma.goalCheckin.findMany({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
      },
      select: { goalId: true, date: true },
      orderBy: { date: 'desc' },
      take: 50,
    }),
  ]);

  return JSON.stringify({ stats, overdueTasks, recentTasks, recentCosts, goals, recentCheckins });
}

/** 通过 Webhook 发送消息 */
async function sendToWebhooks(userId: string, title: string, content: string, webhookTargets: string[]) {
  if (webhookTargets.length === 0) return;
  const setting = await prisma.setting.findFirst({ where: { category: 'NOTIFY', key: 'webhooks' } });
  const allWH: Array<{ name: string; channel: string; url: string }> = setting?.value ? JSON.parse(setting.value) : [];

  for (const targetName of webhookTargets) {
    const wh = allWH.find(w => w.name === targetName);
    if (!wh) continue;
    try {
      await notificationService.sendWebhook(wh.channel, { title, content }, wh.url);
    } catch (err) {
      logger.error({ job: 'custom-job', target: targetName, err }, 'webhook failed');
    }
  }
}

/** 通过邮件发送 */
async function sendToEmail(userId: string, title: string, content: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user?.email) return;
  try {
    await notificationService.sendEmail(user.email, title, content, userId);
  } catch (err) {
    logger.error({ job: 'custom-job', err }, 'email failed');
  }
}

/**
 * 执行自定义任务
 */
export async function executeCustomJob(userId: string, job: {
  id: string; name: string; action: string; config: string; aiModel: string | null;
}): Promise<string> {
  const cfg = parseCfg(job.config);
  const emailEnabled = !!cfg.emailEnabled;
  const webhookTargets: string[] = Array.isArray(cfg.webhookTargets) ? cfg.webhookTargets : [];

  if (job.action === 'NOTIFY') {
    const message = (cfg.message as string) || '';
    if (!message) return '未设置提醒内容';

    // 站内通知
    await notificationService.create(userId, 'REMINDER', job.name, message);

    // Webhook
    await sendToWebhooks(userId, job.name, message, webhookTargets);

    // 邮件
    if (emailEnabled) await sendToEmail(userId, job.name, message);

    return `已发送提醒: ${message.slice(0, 50)}`;
  }

  if (job.action === 'AI_ANALYSIS') {
    const templateId = (cfg.aiTemplate as string) || 'project-progress';
    const customPrompt = (cfg.customPrompt as string) || '';
    const prompt = templateId === 'custom' ? customPrompt : (TEMPLATE_PROMPTS[templateId] || TEMPLATE_PROMPTS['project-progress']);

    if (!prompt) return '未设置分析 Prompt';

    const data = await gatherAnalysisData(userId);
    const ai = new AIService(userId);

    if (!await ai.init()) throw new Error('AI 未配置，请先在系统设置中配置 AI 供应商');

    let result = '';
    for await (const event of ai.chat({
      messages: [{ role: 'system', content: prompt }, { role: 'user', content: data }],
    })) {
      if (event.type === 'text') result += event.content;
    }

    if (result) {
      // 站内通知
      await notificationService.create(userId, 'AI_INSIGHT', job.name, result.slice(0, 500));

      // Webhook
      await sendToWebhooks(userId, job.name, result, webhookTargets);

      // 邮件
      if (emailEnabled) await sendToEmail(userId, job.name, result);
    }

    return result?.slice(0, 200) || 'AI 未返回内容';
  }

  return `未知动作类型: ${job.action}`;
}

/**
 * 测试自定义任务（不发送，只返回预览）
 */
export async function testCustomJob(userId: string, job: {
  id: string; name: string; action: string; config: string; aiModel: string | null;
}): Promise<{ preview: string; channels: Array<{ name: string; status: string }> }> {
  const cfg = parseCfg(job.config);
  const emailEnabled = !!cfg.emailEnabled;
  const webhookTargets: string[] = Array.isArray(cfg.webhookTargets) ? cfg.webhookTargets : [];
  const channels: Array<{ name: string; status: string }> = [];

  // 检查渠道配置
  if (emailEnabled) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    channels.push({ name: '邮件', status: user?.email ? '已配置' : '未设置邮箱' });
  }
  for (const target of webhookTargets) {
    channels.push({ name: target, status: '待发送' });
  }
  if (channels.length === 0) {
    channels.push({ name: '无渠道', status: '未配置任何通知渠道' });
  }

  if (job.action === 'NOTIFY') {
    const message = (cfg.message as string) || '(未设置提醒内容)';
    return { preview: `📨 ${job.name}\n\n${message}`, channels };
  }

  if (job.action === 'AI_ANALYSIS') {
    const templateId = (cfg.aiTemplate as string) || 'project-progress';
    const customPrompt = (cfg.customPrompt as string) || '';
    const prompt = templateId === 'custom' ? customPrompt : (TEMPLATE_PROMPTS[templateId] || '');

    // 快速 AI 预览（用少量数据）
    try {
      const stats = await dashboardService.getStats(userId);
      const data = JSON.stringify(stats);
      const ai = new AIService(userId);
      if (!await ai.init()) {
        return { preview: `🤖 ${job.name}\n\n⚠️ AI 未配置，请先在系统设置中配置 AI 供应商`, channels };
      }

      let result = '';
      for await (const event of ai.chat({
        messages: [{ role: 'system', content: prompt }, { role: 'user', content: `请用 3 句话简要分析以下数据:\n${data}` }],
      })) {
        if (event.type === 'text') result += event.content;
      }
      return { preview: `🤖 ${job.name}\n\n${result || 'AI 未返回内容'}`, channels };
    } catch (err) {
      return { preview: `🤖 ${job.name}\n\n❌ ${err instanceof Error ? err.message : '执行失败'}`, channels };
    }
  }

  return { preview: `未知动作类型: ${job.action}`, channels };
}

// ═══ 自定义任务调度 ═══

let stopCustomJobs: (() => void)[] = [];

/** 注册所有自定义定时任务 */
async function registerCustomJobs(): Promise<void> {
  stopCustomJobs.forEach(stop => stop());
  stopCustomJobs = [];

  const jobs = await prisma.cronJob.findMany({
    where: { isSystem: false, enabled: true },
    select: { id: true, name: true, cronExpr: true, action: true, config: true, aiModel: true, userId: true },
  });

  for (const job of jobs) {
    if (!cron.validate(job.cronExpr)) {
      logger.warn({ job: 'custom-job', name: job.name, cronExpr: job.cronExpr }, '跳过无效 cron');
      continue;
    }

    const jobData = { ...job };
    const task = cron.schedule(job.cronExpr, async () => {
      const start = Date.now();
      logger.info({ job: 'custom-job', name: jobData.name }, '执行');
      try {
        const result = await executeCustomJob(jobData.userId, jobData);
        await logExecution({ jobSlug: `custom-${jobData.id}`, userId: jobData.userId, status: 'success', result, durationMs: Date.now() - start });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error({ job: 'custom-job', name: jobData.name, err }, '失败');
        await logExecution({ jobSlug: `custom-${jobData.id}`, userId: jobData.userId, status: 'error', error: msg, durationMs: Date.now() - start });
      }
    }, { timezone: 'Asia/Shanghai' });

    stopCustomJobs.push(() => task.stop());
  }

  logger.info({ job: 'custom-job', count: jobs.length }, '已注册自定义任务');
}

/** 刷新自定义任务（创建/更新/删除后调用） */
export async function refreshCustomJobs(): Promise<void> {
  await registerCustomJobs();
}

/** 启动自定义任务调度器 */
export function startCustomJobScheduler(): void {
  registerCustomJobs().catch(err => {
    logger.error({ job: 'custom-job', err }, '注册失败');
  });
}
