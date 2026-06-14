'use client';

import { Bot, User as UserIcon, Copy, RotateCcw, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolCallBar, type ToolCallItem } from './ToolCallBar';
import { useState, useMemo } from 'react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result?: unknown;
    status: 'calling' | 'done' | 'error';
    durationMs?: number;
  }>;
  timestamp: Date;
}

interface UserInfo {
  name: string;
  avatar?: string | null;
}

/** tool name → icon + label map */
const TOOL_INFO: Record<string, { icon: string; label: string }> = {
  get_today_focus: { icon: '📋', label: '今日任务' },
  get_profit_analysis: { icon: '💰', label: '利润分析' },
  get_cash_flow: { icon: '📊', label: '现金流' },
  get_cost_breakdown: { icon: '💰', label: '成本明细' },
  get_revenue_by_client: { icon: '👤', label: '客户收入' },
  get_project_margin_ranking: { icon: '📈', label: '利润排名' },
  get_overdue_tasks: { icon: '⚠️', label: '逾期任务' },
  get_project_progress: { icon: '📊', label: '项目进度' },
  create_task: { icon: '✅', label: '创建任务' },
  update_task_status: { icon: '✏️', label: '更新任务' },
  log_time: { icon: '⏱', label: '记录工时' },
  get_schedule: { icon: '📅', label: '排期查询' },
  get_client_follow_up: { icon: '👥', label: '客户跟进' },
  get_client_insights: { icon: '👤', label: '客户详情' },
  log_communication: { icon: '💬', label: '记录沟通' },
  get_client_ranking: { icon: '🏆', label: '客户排名' },
  get_goal_progress: { icon: '🎯', label: '目标进度' },
  get_weekly_review: { icon: '📝', label: '周报' },
  suggest_weekly_plan: { icon: '📝', label: '周计划' },
  create_project: { icon: '📁', label: '创建项目' },
  update_project: { icon: '✏️', label: '更新项目' },
  delete_project: { icon: '🗑️', label: '删除项目' },
  get_business_health: { icon: '🏥', label: '业务健康' },
  get_current_time: { icon: '🕐', label: '获取时间' },
  undo_last_tool: { icon: '↩️', label: '撤销操作' },
  send_email: { icon: '📧', label: '发送邮件' },
  send_webhook: { icon: '🔗', label: '发送通知' },
  delete_task: { icon: '🗑️', label: '删除任务' },
  assess_complexity: { icon: '🧮', label: '复杂度评估' },
  evaluate_insertion: { icon: '📊', label: '插单评估' },
  suggest_rebalance: { icon: '⚖️', label: '重平衡建议' },
  get_schedule_advice: { icon: '💡', label: '排期建议' },
  get_historical_accuracy: { icon: '📈', label: '工时准确度' },
  create_customer: { icon: '👤', label: '创建客户' },
  update_customer: { icon: '✏️', label: '更新客户' },
  list_transactions: { icon: '💳', label: '收支流水' },
  create_transaction: { icon: '💳', label: '录入流水' },
  update_transaction: { icon: '✏️', label: '编辑流水' },
  delete_transaction: { icon: '🗑️', label: '删除流水' },
  create_payment: { icon: '💵', label: '录入收款' },
  list_payments: { icon: '💵', label: '收款记录' },
  get_receivables: { icon: '💰', label: '应收账款' },
  get_aging_analysis: { icon: '📊', label: '账龄分析' },
  create_cost: { icon: '💰', label: '录入成本' },
  delete_cost: { icon: '🗑️', label: '删除成本' },
  list_projects: { icon: '📁', label: '项目列表' },
  get_project_detail: { icon: '📁', label: '项目详情' },
  archive_project: { icon: '📦', label: '归档项目' },
  list_tasks: { icon: '📋', label: '任务列表' },
  get_task_stats: { icon: '📊', label: '任务统计' },
  list_customers: { icon: '👥', label: '客户列表' },
  delete_customer: { icon: '🗑️', label: '删除客户' },
  list_goals: { icon: '🎯', label: '目标列表' },
  get_goal_overview: { icon: '🎯', label: '目标总览' },
  create_goal: { icon: '🎯', label: '创建目标' },
  update_goal: { icon: '✏️', label: '更新目标' },
  update_goal_progress: { icon: '📈', label: '目标进度' },
  get_today_entries: { icon: '⏱', label: '今日工时' },
  get_active_timer: { icon: '⏱', label: '计时器' },
  list_todos: { icon: '📝', label: '待办列表' },
  add_todo: { icon: '📝', label: '添加待办' },
  toggle_todo: { icon: '✅', label: '完成待办' },
  get_report_overview: { icon: '📊', label: '报表总览' },
  get_project_ranking: { icon: '📈', label: '项目排名' },
  get_cost_structure: { icon: '📊', label: '成本结构' },
  get_time_analysis: { icon: '⏱', label: '工时分析' },
  get_dashboard_summary: { icon: '📈', label: '仪表盘' },
  get_recent_activity: { icon: '📋', label: '最近活动' },
  list_notifications: { icon: '🔔', label: '通知列表' },
  get_unread_count: { icon: '🔔', label: '未读通知' },
  mark_as_read: { icon: '✅', label: '标记已读' },
  list_subscriptions: { icon: '📦', label: '订阅列表' },
  get_subscription_cost: { icon: '💰', label: '订阅费用' },
  create_subscription: { icon: '📦', label: '创建订阅' },
  pause_subscription: { icon: '⏸', label: '暂停订阅' },
  resume_subscription: { icon: '▶️', label: '恢复订阅' },
};

interface MessageBubbleProps {
  message: ChatMessage;
  user: UserInfo | null;
  onRegenerate?: () => void;
}

export function MessageBubble({ message, user, onRegenerate }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  function handleCopy() {
    navigator.clipboard.writeText(cleanContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }

  // 将 tool calls 转为 ToolCallItem
  const toolItems: ToolCallItem[] = (message.toolCalls || []).map(tc => {
    const info = TOOL_INFO[tc.name] || { icon: '🔧', label: tc.name };
    return { ...info, name: tc.name, status: tc.status, durationMs: tc.durationMs };
  });

  // 工具调用耗时模拟
  const toolDoneCount = toolItems.filter(t => t.status === 'done').length;

  // 过滤旧消息中拼接的 [工具调用] 原始文本（兼容历史数据）
  const cleanContent = useMemo(() => {
    if (isUser) return message.content;
    // 去掉末尾的 [工具调用] ... 区块
    return message.content
      .replace(/\n*\[工具调用\][\s\S]*$/, '')
      .trim();
  }, [message.content, isUser]);

  return (
    <div className={cn('flex gap-3 group', isUser && 'flex-row-reverse')}>
      {/* 头像 */}
      {isUser ? (
        <UserAvatar user={user} />
      ) : (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#5B5FC7]/10 text-[#5B5FC7]">
          <Bot className="h-3.5 w-3.5" />
        </div>
      )}

      {/* 消息体 */}
      <div className={cn('min-w-0 max-w-[85%]', isUser && 'flex flex-col items-end')}>
        {/* 工具调用（仅 AI 消息） */}
        {!isUser && toolItems.length > 0 && (
          <div className="mb-1.5">
            <ToolCallBar tools={toolItems} />
          </div>
        )}

        {/* 消息气泡 */}
        {cleanContent && (
          <div className={cn(
            'rounded-2xl px-4 py-3 text-sm leading-relaxed',
            isUser
              ? 'rounded-tr-md bg-indigo-600 text-white'
              : 'rounded-tl-md border border-slate-200 bg-background text-foreground shadow-sm',
          )}>
            {isUser ? (
              <p className="whitespace-pre-wrap">{cleanContent}</p>
            ) : (
              <MarkdownRenderer content={cleanContent} />
            )}
          </div>
        )}

        {/* 时间 + 操作 */}
        <div className={cn(
          'mt-1 flex items-center gap-2 text-2xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100',
          isUser && 'flex-row-reverse',
        )}>
          <span>{formatTime(message.timestamp)}</span>

          {!isUser && (
            <>
              <button onClick={handleCopy} className="flex items-center gap-0.5 hover:text-indigo-500 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none rounded px-1">
                {copied ? <Check className="h-3 w-3 text-emerald-500" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
                {copied ? '已复制' : '复制'}
              </button>
              {onRegenerate && (
                <button onClick={onRegenerate} className="flex items-center gap-0.5 hover:text-indigo-500 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none rounded px-1">
                  <RotateCcw className="h-3 w-3" aria-hidden="true" />
                  重新生成
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** 用户头像组件 */
function UserAvatar({ user }: { user: UserInfo | null }) {
  if (!user) {
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <UserIcon className="h-3.5 w-3.5" />
      </div>
    );
  }

  if (user.avatar) {
    return (
      <img
        src={user.avatar}
        alt={user.name}
        className="h-7 w-7 shrink-0 rounded-full object-cover ring-2 ring-border"
      />
    );
  }

  const initial = user.name?.charAt(0)?.toUpperCase() || 'U';
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-600 ring-2 ring-slate-100">
      {initial}
    </div>
  );
}

function formatTime(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) + ' ' +
    d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}
