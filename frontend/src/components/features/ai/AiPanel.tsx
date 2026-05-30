'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Loader2, Send, X, Bot, User as UserIcon,
  Plus, MessageSquare, Clock, Trash2, ChevronLeft,
  FolderKanban, CheckSquare, Lightbulb,
  AlertCircle, TrendingUp, Zap, Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAiChat } from '@/hooks/useAiChat';
import { useProjectList } from '@/hooks/useProjects';
import { api } from '@/lib/api';

// ═══ 工具调用展示图标 ═══

const TOOL_ICONS: Record<string, { icon: string; label: string }> = {
  get_today_focus:       { icon: '📋', label: '查询今日任务' },
  get_profit_analysis:   { icon: '💰', label: '分析项目利润' },
  get_cash_flow:         { icon: '📊', label: '查询现金流' },
  get_cost_breakdown:    { icon: '💰', label: '查询成本明细' },
  get_revenue_by_client: { icon: '👤', label: '查询客户收入' },
  get_project_margin_ranking: { icon: '📈', label: '查询项目利润排名' },
  get_overdue_tasks:     { icon: '⚠️', label: '查询延期任务' },
  get_project_progress:  { icon: '📊', label: '查询项目进度' },
  create_task:           { icon: '✅', label: '创建任务' },
  update_task_status:    { icon: '✏️', label: '更新任务状态' },
  log_time:              { icon: '⏱', label: '记录工时' },
  get_schedule:          { icon: '📅', label: '查询排期' },
  get_client_follow_up:  { icon: '👥', label: '查询待跟进客户' },
  get_client_insights:   { icon: '👤', label: '查询客户详情' },
  log_communication:     { icon: '💬', label: '记录沟通' },
  get_client_ranking:    { icon: '🏆', label: '客户价值排名' },
  get_goal_progress:     { icon: '🎯', label: '查询目标进度' },
  get_weekly_review:     { icon: '📝', label: '生成周报' },
  suggest_weekly_plan:   { icon: '📝', label: '生成周计划' },
  get_business_health:   { icon: '🏥', label: '评估业务健康度' },
};

// ═══ 类型 ═══

type WorkspaceTab = 'overview' | 'tasks' | 'quick';

// ═══ 快捷提问 ═══

const quickPrompts = [
  { icon: CheckSquare, label: '今日焦点', text: '今天做什么？' },
  { icon: FolderKanban, label: '项目进度', text: '项目完成情况怎么样？' },
  { icon: TrendingUp, label: '成本分析', text: '这个月花了多少钱？' },
  { icon: AlertCircle, label: '风险预警', text: '有什么延期的任务？' },
  { icon: Lightbulb, label: '客户跟进', text: '该联系哪个客户了？' },
  { icon: Zap, label: '周计划', text: '帮我安排下周的工作' },
];

// ═══ 组件 ═══

export function AiPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  // AI hook
  const { messages, isLoading, currentToolCalls, sendMessage, loadHistory, getSessions, deleteSession, setMessages } = useAiChat();

  // 项目数据
  const { data: projectData } = useProjectList({ status: 'ACTIVE' });

  // 会话管理
  const [sessions, setSessions] = useState<Array<{ sessionId: string; messageCount: number; lastMessage: Date }>>([]);
  const [activeSessionId, setActiveSessionId] = useState('default');

  // UI 状态
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [wsTab, setWsTab] = useState<WorkspaceTab>('overview');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, currentToolCalls]);

  useEffect(() => {
    if (open) { getSessions().then(setSessions).catch(() => {}); }
  }, [open, getSessions]);

  function handleNewConvo() {
    const newId = Date.now().toString();
    setActiveSessionId(newId);
    setMessages([]);
    setShowHistory(false);
  }

  async function handleSend(text?: string) {
    const content = text || input.trim();
    if (!content || isLoading) return;
    setInput('');
    await sendMessage(content, activeSessionId);
    getSessions().then(setSessions).catch(() => {});
  }

  function handleSwitchSession(sid: string) {
    setActiveSessionId(sid);
    loadHistory(sid);
    setShowHistory(false);
  }

  async function handleDelete(sid: string) {
    await deleteSession(sid);
    if (sid === activeSessionId) {
      const newId = Date.now().toString();
      setActiveSessionId(newId);
      setMessages([]);
    }
    getSessions().then(setSessions).catch(() => {});
  }

  // ═══ 任务数据 ═══
  const [taskData, setTaskData] = useState<Array<{ id: string; title: string; priority: string; dueDate: string; status: string; projectName: string }>>([]);
  useEffect(() => {
    if (!open) return;
    api.get<any[]>('/tasks?status=TODO,IN_PROGRESS').then(t => {
      setTaskData((t || []).slice(0, 10).map((x: any) => ({
        id: x.id, title: x.title, priority: x.priority, dueDate: x.dueDate ? x.dueDate.slice(0, 10) : '-', status: x.status, projectName: x.project?.name || ''
      })));
    }).catch(() => {});
  }, [open]);

  const priorityDot: Record<string, string> = { URGENT: 'bg-red-500', HIGH: 'bg-orange-500', MEDIUM: 'bg-amber-400', LOW: 'bg-slate-300' };
  const statusCN: Record<string, string> = { TODO: 'bg-slate-100 text-slate-500', IN_PROGRESS: 'bg-blue-50 text-blue-600', DONE: 'bg-emerald-50 text-emerald-600', BLOCKED: 'bg-red-50 text-red-500' };
  const statusLabel: Record<string, string> = { TODO: '待办', IN_PROGRESS: '进行中', DONE: '完成', BLOCKED: '阻塞' };

  const wsTabs: { key: WorkspaceTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'overview', label: '项目', icon: FolderKanban },
    { key: 'tasks', label: '任务', icon: CheckSquare },
    { key: 'quick', label: '快捷', icon: Zap },
  ];

  const projects = projectData?.data || [];

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity" onClick={onClose} />}

      <div className={cn(
        'fixed right-0 top-0 z-50 flex h-screen w-[900px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out',
        open ? 'translate-x-0' : 'translate-x-full',
      )}>
        {/* 顶部栏 */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b bg-slate-50/80 px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100">
              <Zap className="h-3.5 w-3.5 text-indigo-600" />
            </div>
            <span className="text-sm font-semibold text-slate-800">TaskFlow+ AI</span>
            <span className="text-[11px] text-slate-400">工作区</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowHistory(!showHistory)} className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600" title="对话历史">
              <Clock className="h-4 w-4" />
            </button>
            <button onClick={handleNewConvo} className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600" title="新对话">
              <Plus className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 对话历史浮层 */}
        {showHistory && (
          <div className="absolute inset-x-0 top-12 bottom-0 z-20 flex flex-col bg-white">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-semibold text-slate-700">对话历史</span>
              <button onClick={() => setShowHistory(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {sessions.map((s) => (
                <div key={s.sessionId} role="button" tabIndex={0}
                  onClick={() => handleSwitchSession(s.sessionId)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSwitchSession(s.sessionId); }}
                  className={cn('group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50', s.sessionId === activeSessionId && 'bg-indigo-50/50')}>
                  <MessageSquare className="h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-700">{s.sessionId === 'default' ? '默认会话' : `会话 ${s.sessionId.slice(0, 8)}`}</p>
                    <p className="text-[11px] text-slate-400">{s.messageCount} 条消息</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(s.sessionId); }}
                    className="rounded p-1 text-slate-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 主体 */}
        <div className="flex min-h-0 flex-1">
          {/* 左侧工作区 */}
          <div className="flex w-[360px] shrink-0 flex-col border-r bg-slate-50/40">
            <div className="flex border-b px-2 pt-2">
              {wsTabs.map((tab) => (
                <button key={tab.key} onClick={() => setWsTab(tab.key)}
                  className={cn('flex items-center gap-1 rounded-t-md px-3 py-1.5 text-[12px] font-medium transition-colors',
                    wsTab === tab.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600')}>
                  <tab.icon className="h-3.5 w-3.5" /> {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {/* 项目概览 Tab */}
              {wsTab === 'overview' && (
                <div className="space-y-2.5">
                  {projects.map((p: any) => (
                    <div key={p.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] font-medium text-slate-800">{p.name}</p>
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">{p.status}</span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                        <span>{p.budget ? `¥${p.budget / 100}` : '-'}</span>
                        <span>{p.startDate?.slice(0, 10)}</span>
                      </div>
                    </div>
                  ))}
                  {projects.length === 0 && <p className="text-center text-xs text-slate-400 py-8">暂无活跃项目</p>}
                  <div className="mt-3">
                    <p className="mb-1.5 text-[11px] font-semibold text-slate-400">快捷提问</p>
                    {quickPrompts.slice(0, 3).map((q) => (
                      <button key={q.text} onClick={() => handleSend(q.text)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-slate-600 transition-colors hover:bg-white hover:text-indigo-600">
                        <q.icon className="h-3.5 w-3.5 text-slate-400" /> {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 任务 Tab */}
              {wsTab === 'tasks' && (
                <div className="space-y-2">
                  {taskData.map((t) => (
                    <div key={t.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-start gap-2">
                        <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', priorityDot[t.priority] || 'bg-slate-300')} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-slate-800">{t.title}</p>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                            <span>{t.projectName}</span>
                            <span>·</span>
                            <span>{t.dueDate === '-' ? '未设定' : `截止 ${t.dueDate}`}</span>
                          </div>
                        </div>
                        <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', statusCN[t.status] || '')}>{statusLabel[t.status] || t.status}</span>
                      </div>
                    </div>
                  ))}
                  {taskData.length === 0 && <p className="text-center text-xs text-slate-400 py-8">暂无待办任务</p>}
                  <div className="mt-3">
                    <p className="mb-1.5 text-[11px] font-semibold text-slate-400">快捷提问</p>
                    {quickPrompts.slice(3, 6).map((q) => (
                      <button key={q.text} onClick={() => handleSend(q.text)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-slate-600 transition-colors hover:bg-white hover:text-indigo-600">
                        <q.icon className="h-3.5 w-3.5 text-slate-400" /> {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 快捷操作 Tab */}
              {wsTab === 'quick' && (
                <div className="space-y-2">
                  <p className="text-[12px] text-slate-500 mb-2">点击下方按钮自动发送问题</p>
                  {quickPrompts.map((q) => (
                    <button key={q.text} onClick={() => handleSend(q.text)}
                      className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left text-[13px] font-medium text-slate-700 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600">
                      <q.icon className="h-4 w-4 text-slate-400" /> {q.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 右侧对话区 */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-4">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Bot className="h-12 w-12 mb-3" />
                    <p className="text-sm font-medium">TaskFlow+ AI 助手</p>
                    <p className="text-xs mt-1">从左侧选择快捷提问，或直接输入问题</p>
                  </div>
                )}
                {messages.map((msg) => (
                  <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}>
                    <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                      msg.role === 'assistant' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600')}>
                      {msg.role === 'assistant' ? <Bot className="h-3.5 w-3.5" /> : <UserIcon className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0">
                      {/* 工具调用卡片 */}
                      {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div className="mb-1.5 space-y-0.5">
                          {msg.toolCalls.map((tc, i) => {
                            const info = TOOL_ICONS[tc.name] || { icon: '🔧', label: tc.name };
                            return (
                              <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                {tc.status === 'calling' && <Loader2 className="h-3 w-3 animate-spin" />}
                                {tc.status === 'done' && <Check className="h-3 w-3 text-green-500" />}
                                <span>{info.icon} {info.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {/* 消息内容 */}
                      {msg.content && (
                        <div className={cn('max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed',
                          msg.role === 'assistant' ? 'rounded-tl-sm bg-slate-100 text-slate-700' : 'rounded-tr-sm bg-indigo-600 text-white')}>
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-indigo-600"><Bot className="h-3.5 w-3.5" /></div>
                    <div className="rounded-tl-sm rounded-xl bg-slate-100 px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                        <span className="text-[12px] text-slate-400">思考中...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* 输入区 */}
            <div className="shrink-0 border-t bg-white p-3">
              <div className="flex gap-2">
                <textarea value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="输入问题... (Enter 发送, Shift+Enter 换行)" rows={1}
                  className="min-h-[38px] max-h-24 flex-1 resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-1 focus:ring-indigo-200"
                  disabled={isLoading} />
                <button onClick={() => handleSend()} disabled={isLoading || !input.trim()}
                  className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white transition-all duration-100 hover:bg-indigo-700 active:scale-95 disabled:opacity-40">
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-slate-300">AI 回答仅供参考，请以实际数据为准</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

