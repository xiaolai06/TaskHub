'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/providers/ThemeProvider';
import {
  Loader2, CheckCircle, Settings, Bell, Monitor, MessageSquare,
  Sun, Moon, Search, X, Eye,
} from 'lucide-react';

// ========== 类型 ==========

interface Preferences {
  theme: string;
  timezone: string;
  dateFormat: string;
  startPage: string;
  taskReminder: boolean;
  reminderDays: number;
  projectNotify: boolean;
  systemNotify: boolean;
  emailNotify: boolean;
  dndStart: string;
  dndEnd: string;
  sidebarCollapsed: boolean;
  pageSize: number;
  defaultView: string;
  showStats: boolean;
}

interface GreetingItem {
  id: string;
  content: string;
  hourStart: number;
  hourEnd: number;
  isActive: boolean;
  source: string;
}

type TabKey = 'general' | 'display' | 'notify' | 'greetings';

// ========== 设置项组件 ==========

function Toggle({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {desc && <p className="text-[12px] text-slate-500">{desc}</p>}
      </div>
      <button onClick={() => onChange(!checked)}
        className={cn('relative h-6 w-11 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none', checked ? 'bg-indigo-600' : 'bg-slate-200')}>
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </div>
  );
}

function Select({ label, desc, value, onChange, options }: { label: string; desc?: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {desc && <p className="text-[12px] text-slate-500">{desc}</p>}
      </div>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function NumberSelect({ label, desc, value, onChange, options }: { label: string; desc?: string; value: number; onChange: (v: number) => void; options: { value: number; label: string }[] }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {desc && <p className="text-[12px] text-slate-500">{desc}</p>}
      </div>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ========== 主题切换 ==========

function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const options = [
    { key: 'light' as const, label: '浅色', icon: Sun },
    { key: 'dark' as const, label: '深色', icon: Moon },
    { key: 'system' as const, label: '跟随系统', icon: Monitor },
  ];
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-slate-700">主题模式</p>
        <p className="text-[12px] text-slate-500">选择界面外观</p>
      </div>
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
        {options.map((o) => (
          <button key={o.key} onClick={() => setTheme(o.key)}
            className={cn('flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none',
              theme === o.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50')}>
            <o.icon className="h-3.5 w-3.5" />{o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ========== 祝福语预览弹窗 ==========

function GreetingPreview({ onClose }: { onClose: () => void }) {
  const [greetings, setGreetings] = useState<GreetingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [hourFilter, setHourFilter] = useState<number | null>(null);

  useEffect(() => {
    api.get<GreetingItem[]>('/greetings/all')
      .then((res) => setGreetings(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // 内置语录（按小时段）
  const builtin: Record<string, string[]> = {
    '早安 (6-8点)': ['早安，新的一天开始了 ☀️', '早上好，今天也要加油呀', '早安，记得吃早餐哦', '早起的鸟儿有虫吃 🐦'],
    '上午 (9-11点)': ['上午好，专注工作 💪', '上午好，效率满满', '上午好，保持节奏', '上午好，深呼吸，继续前进'],
    '中午 (12-13点)': ['中午好，该休息一下了 🍜', '中午好，别忘了午休', '中午好，给自己充充电 🔋'],
    '下午 (14-16点)': ['下午好，继续加油 ☕', '下午好，保持专注', '下午好，今天的你很棒'],
    '傍晚 (17-19点)': ['傍晚好，辛苦了 🌅', '傍晚好，收尾工作', '傍晚好，给自己一个微笑 😊'],
    '晚上 (20-22点)': ['晚上好，注意休息 🌙', '晚上好，别太晚了', '晚上好，复盘一下今天吧'],
    '深夜 (23-5点)': ['夜深了，早点休息吧 🌛', '夜猫子模式 🦉', '夜深了，好梦在等你'],
  };

  const filtered = greetings.filter((g) => {
    if (filter && !g.content.includes(filter)) return false;
    if (hourFilter !== null && (hourFilter < g.hourStart || hourFilter > g.hourEnd)) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-800">祝福语库</h3>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>

        {/* 筛选 */}
        <div className="flex gap-2 border-b px-5 py-3">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
            <Search className="h-4 w-4 text-slate-400" />
            <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)}
              placeholder="搜索语录..." className="flex-1 bg-transparent text-sm text-slate-600 outline-none" />
            {filter && <button onClick={() => setFilter('')} className="text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>}
          </div>
          <select value={hourFilter ?? ''} onChange={(e) => setHourFilter(e.target.value ? Number(e.target.value) : null)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 outline-none">
            <option value="">全部时段</option>
            {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i}:00</option>)}
          </select>
        </div>

        {/* 内置语录 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">内置语录（48 条）</p>
            {Object.entries(builtin).map(([label, items]) => (
              <div key={label} className="mb-3">
                <p className="mb-1 text-[12px] font-medium text-slate-500">{label}</p>
                <div className="space-y-1">
                  {items.filter((m) => !filter || m.includes(filter)).map((m, i) => (
                    <div key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-600">{m}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 自定义语录 */}
          {filtered.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">自定义语录（{filtered.length} 条）</p>
              <div className="space-y-1">
                {filtered.map((g) => (
                  <div key={g.id} className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2">
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', g.isActive ? 'bg-emerald-500' : 'bg-slate-300')} />
                    <span className="flex-1 text-[13px] text-slate-700">{g.content}</span>
                    <span className="text-[11px] text-slate-500">{g.hourStart}:00—{g.hourEnd}:00</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ========== 祝福语管理 ==========

function GreetingManager() {
  const [greetings, setGreetings] = useState<GreetingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState('');
  const [newStart, setNewStart] = useState(0);
  const [newEnd, setNewEnd] = useState(23);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    api.get<GreetingItem[]>('/greetings/all')
      .then((res) => setGreetings(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd() {
    if (!newContent.trim()) return;
    try {
      const created = await api.post<GreetingItem>('/greetings', {
        content: newContent.trim(), hourStart: newStart, hourEnd: newEnd,
      });
      setGreetings((prev) => [created, ...prev]);
      setNewContent('');
    } catch {}
  }

  async function handleToggle(id: string, isActive: boolean) {
    try {
      await api.put(`/greetings/${id}`, { isActive: !isActive });
      setGreetings((prev) => prev.map((g) => g.id === id ? { ...g, isActive: !isActive } : g));
    } catch {}
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/greetings/${id}`);
      setGreetings((prev) => prev.filter((g) => g.id !== id));
    } catch {}
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-4">
      {/* 预览按钮 */}
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-slate-500">自定义语录与内置 48 条合并轮换</p>
        <button onClick={() => setShowPreview(true)}
          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50">
          <Eye className="h-3.5 w-3.5" />查看全部语录
        </button>
      </div>

      {/* 添加 */}
      <div className="flex gap-2">
        <input type="text" value={newContent} onChange={(e) => setNewContent(e.target.value)}
          placeholder="输入新的祝福语..." onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none" />
        <select value={newStart} onChange={(e) => setNewStart(Number(e.target.value))}
          className="rounded-lg border border-slate-200 px-2 py-2 text-xs text-slate-600 outline-none">
          {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i}:00</option>)}
        </select>
        <span className="self-center text-xs text-slate-500">—</span>
        <select value={newEnd} onChange={(e) => setNewEnd(Number(e.target.value))}
          className="rounded-lg border border-slate-200 px-2 py-2 text-xs text-slate-600 outline-none">
          {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i}:00</option>)}
        </select>
        <button onClick={handleAdd} disabled={!newContent.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none">添加</button>
      </div>

      {/* 列表 */}
      {greetings.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">暂无自定义语录</p>
      ) : (
        <div className="divide-y rounded-lg border border-slate-200">
          {greetings.map((g) => (
            <div key={g.id} className="flex items-center gap-3 px-4 py-2.5">
              <button onClick={() => handleToggle(g.id, g.isActive)}
                className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors', g.isActive ? 'bg-indigo-600' : 'bg-slate-200')}>
                <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', g.isActive ? 'left-[18px]' : 'left-0.5')} />
              </button>
              <span className={cn('flex-1 text-sm', g.isActive ? 'text-slate-700' : 'text-slate-400')}>{g.content}</span>
              <span className="shrink-0 text-[11px] text-slate-500">{g.hourStart}:00—{g.hourEnd}:00</span>
              <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10px]',
                g.source === 'custom' ? 'bg-blue-50 text-blue-600' : g.source === 'ai' ? 'bg-purple-50 text-purple-600' : 'bg-slate-100 text-slate-500')}>
                {g.source === 'custom' ? '自定义' : g.source === 'ai' ? 'AI' : '系统'}
              </span>
              <button onClick={() => handleDelete(g.id)}
                className="shrink-0 text-[11px] text-red-400 hover:text-red-600">删除</button>
            </div>
          ))}
        </div>
      )}

      {/* 预览弹窗 */}
      {showPreview && <GreetingPreview onClose={() => setShowPreview(false)} />}
    </div>
  );
}

// ========== 主页面 ==========

export default function PreferencesPage() {
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('general');

  useEffect(() => {
    api.get<Preferences>('/preferences')
      .then((res) => setPrefs(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function update(patch: Partial<Preferences>) {
    if (!prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setSaving(true);
    setSaved(false);
    api.put('/preferences', patch)
      .then(() => { setSaved(true); setTimeout(() => setSaved(false), 2000); })
      .catch(() => {})
      .finally(() => setSaving(false));
  }

  if (loading || !prefs) {
    return <div className="flex items-center justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>;
  }

  const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'general', label: '通用设置', icon: Settings },
    { key: 'display', label: '显示设置', icon: Monitor },
    { key: 'notify', label: '通知设置', icon: Bell },
    { key: 'greetings', label: '祝福语', icon: MessageSquare },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold text-slate-800">偏好设置</h1>
        <div className="flex items-center gap-2 text-sm">
          {saving && <span className="flex items-center gap-1 text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" />保存中...</span>}
          {saved && <span className="flex items-center gap-1 text-emerald-500"><CheckCircle className="h-3.5 w-3.5" />已保存</span>}
        </div>
      </div>

      {/* 分类标签 */}
      <div className="mb-5 flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn('flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-all focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none',
              activeTab === tab.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50')}>
            <tab.icon className="h-4 w-4" />{tab.label}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm">
        {activeTab === 'general' && (
          <div className="divide-y px-6">
            <ThemeSwitcher />
            <Select label="时区" desc="日期时间显示时区" value={prefs.timezone} onChange={(v) => update({ timezone: v })}
              options={[{ value: 'Asia/Shanghai', label: 'UTC+8 北京' }, { value: 'Asia/Tokyo', label: 'UTC+9 东京' }, { value: 'America/New_York', label: 'UTC-5 纽约' }]} />
            <Select label="日期格式" value={prefs.dateFormat} onChange={(v) => update({ dateFormat: v })}
              options={[{ value: 'YYYY-MM-DD', label: '2026-05-30' }, { value: 'MM/DD/YYYY', label: '05/30/2026' }, { value: 'DD/MM/YYYY', label: '30/05/2026' }]} />
            <Select label="启动页面" desc="登录后默认打开" value={prefs.startPage} onChange={(v) => update({ startPage: v })}
              options={[{ value: '/main/dashboard', label: '仪表盘' }, { value: '/main/projects', label: '项目管理' }, { value: '/main/tasks', label: '任务看板' }]} />
          </div>
        )}

        {activeTab === 'display' && (
          <div className="divide-y px-6">
            <Toggle label="侧边栏默认折叠" desc="登录后侧边栏是否收起" checked={prefs.sidebarCollapsed} onChange={(v) => update({ sidebarCollapsed: v })} />
            <NumberSelect label="每页显示数量" desc="列表页面默认条数" value={prefs.pageSize} onChange={(v) => update({ pageSize: v })}
              options={[{ value: 10, label: '10 条' }, { value: 20, label: '20 条' }, { value: 50, label: '50 条' }]} />
            <Select label="任务默认视图" value={prefs.defaultView} onChange={(v) => update({ defaultView: v })}
              options={[{ value: 'list', label: '列表视图' }, { value: 'board', label: '看板视图' }, { value: 'calendar', label: '日历视图' }]} />
            <Toggle label="显示统计卡片" desc="仪表盘顶部的统计数字" checked={prefs.showStats} onChange={(v) => update({ showStats: v })} />
          </div>
        )}

        {activeTab === 'notify' && (
          <div className="divide-y px-6">
            <Toggle label="任务到期提醒" desc="任务临近截止日期时提醒" checked={prefs.taskReminder} onChange={(v) => update({ taskReminder: v })} />
            {prefs.taskReminder && (
              <NumberSelect label="提前提醒时间" value={prefs.reminderDays} onChange={(v) => update({ reminderDays: v })}
                options={[{ value: 1, label: '提前 1 天' }, { value: 3, label: '提前 3 天' }, { value: 7, label: '提前 1 周' }]} />
            )}
            <Toggle label="项目进度通知" desc="项目状态变更时通知" checked={prefs.projectNotify} onChange={(v) => update({ projectNotify: v })} />
            <Toggle label="系统消息推送" desc="系统公告、报表生成等" checked={prefs.systemNotify} onChange={(v) => update({ systemNotify: v })} />
            <Toggle label="邮件通知" desc="发送邮件摘要（需配置邮箱）" checked={prefs.emailNotify} onChange={(v) => update({ emailNotify: v })} />
          </div>
        )}

        {activeTab === 'greetings' && (
          <div className="px-6 py-4">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-700">自定义祝福语</h3>
              <p className="text-[12px] text-slate-500">自定义语录会与内置语录合并轮换，按时段显示</p>
            </div>
            <GreetingManager />
          </div>
        )}
      </div>
    </div>
  );
}
