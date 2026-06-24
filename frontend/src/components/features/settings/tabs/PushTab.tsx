'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle, AlertCircle, Trash2, Plus } from 'lucide-react';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';

interface WebhookItem {
  name: string;
  channel: string;
  url: string;
}

const CHANNEL_OPTIONS = [
  { value: 'wechat', label: '企业微信', icon: '💬' },
  { value: 'feishu', label: '飞书', icon: '🐦' },
  { value: 'dingtalk', label: '钉钉', icon: '📌' },
  { value: 'slack', label: 'Slack', icon: '🔔' },
];

export function PushTab() {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [testing, setTesting] = useState('');
  const [testResult, setTestResult] = useState<{ name: string; success: boolean; message: string } | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addChannel, setAddChannel] = useState('wechat');
  const [addUrl, setAddUrl] = useState('');
  const [addErr, setAddErr] = useState('');

  useEffect(() => {
    api.get<Record<string, string>>('/settings/notify')
      .then((res) => {
        if (res.webhooks) {
          try { setWebhooks(JSON.parse(res.webhooks)); } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(list: WebhookItem[]) {
    setSaving(true);
    setSaveErr('');
    try {
      await api.post('/settings/batch', {
        settings: [
          { category: 'NOTIFY', key: 'webhooks', value: JSON.stringify(list) },
        ],
      });
      setWebhooks(list);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : '保存失败');
    } finally { setSaving(false); }
  }

  function handleAdd() {
    setAddErr('');
    const name = addName.trim();
    if (!name) { setAddErr('请填写昵称'); return; }
    if (!addUrl.trim()) { setAddErr('请填写 Webhook URL'); return; }
    if (webhooks.some(w => w.name === name)) { setAddErr(`昵称"${name}"已存在`); return; }
    const next = [...webhooks, { name, channel: addChannel, url: addUrl.trim() }];
    handleSave(next);
    setAddOpen(false);
    setAddName(''); setAddUrl(''); setAddChannel('wechat');
  }

  function handleRemove(name: string) {
    const next = webhooks.filter(w => w.name !== name);
    handleSave(next);
  }

  async function handleTest(item: WebhookItem) {
    setTesting(item.name);
    setTestResult(null);
    try {
      await api.post('/settings/webhook/test', { channel: item.channel, url: item.url });
      setTestResult({ name: item.name, success: true, message: '测试消息已发送，请检查群聊' });
    } catch (err) {
      setTestResult({ name: item.name, success: false, message: err instanceof Error ? err.message : '发送失败' });
    } finally { setTesting(''); }
  }

  const inputCls = 'w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60';
  const selectCls = 'w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60 bg-card';

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">配置群机器人 Webhook，定时任务和 AI 可自动推送消息到群聊。每个推送目标需要设置一个昵称，AI 通过昵称识别发送目标。</p>
        </div>
        <button onClick={() => setAddOpen(true)}
          className="flex h-9 items-center gap-1 rounded-lg bg-indigo-600 px-3.5 text-sm font-medium text-white transition-all hover:bg-indigo-700 active:scale-95">
          <Plus className="h-4 w-4" />添加推送
        </button>
      </div>

      {webhooks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">暂未配置推送目标</p>
          <p className="mt-1 text-2xs-plus text-muted-foreground">点击"添加推送"配置企业微信/飞书/钉钉群机器人</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {webhooks.map((wh) => {
            const ch = CHANNEL_OPTIONS.find(c => c.value === wh.channel);
            return (
              <div key={wh.name} className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-lg dark:bg-indigo-950/40">{ch?.icon || '🔗'}</span>
                <div className="w-28 shrink-0">
                  <p className="text-sm font-semibold text-foreground">{wh.name}</p>
                  <p className="text-2xs-plus text-muted-foreground">{ch?.label || wh.channel}</p>
                </div>
                <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{wh.url}</p>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button onClick={() => handleTest(wh)} disabled={testing === wh.name}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground/60 transition-all hover:bg-accent disabled:opacity-50">
                    {testing === wh.name ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '测试'}
                  </button>
                  <button onClick={() => handleRemove(wh.name)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
          {testResult && (
            <p className={cn('text-xs', testResult.success ? 'text-emerald-500' : 'text-red-500')}>
              {testResult.message}
            </p>
          )}
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
          <CheckCircle className="h-4 w-4" />推送配置已保存
        </div>
      )}
      {saveErr && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />{saveErr}
        </div>
      )}

      {/* 添加弹窗 */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => { setAddOpen(false); setAddErr(''); }}>
          <div className="mx-4 w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="mb-4 text-base font-semibold text-foreground">添加推送目标</h3>
            <div className="space-y-3.5">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">昵称（AI 通过此名称识别目标）</label>
                <input value={addName} onChange={e => { setAddName(e.target.value); setAddErr(''); }}
                  placeholder="如：项目群、客户群、日报群" className={cn(inputCls, addErr && 'border-red-400')} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">渠道</label>
                <Select value={addChannel} onValueChange={v => setAddChannel(v || 'wechat')}>
                  <SelectTrigger className={cn(selectCls, "w-full")}><SelectValue placeholder="选择渠道" /></SelectTrigger>
                  <SelectContent>
                    {CHANNEL_OPTIONS.map(ch => <SelectItem key={ch.value} value={ch.value}>{ch.icon} {ch.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Webhook URL</label>
                <input value={addUrl} onChange={e => { setAddUrl(e.target.value); setAddErr(''); }}
                  placeholder={CHANNEL_OPTIONS.find(c => c.value === addChannel)?.value === 'wechat' ? 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx' : 'https://...'}
                  className={cn(inputCls, addErr && 'border-red-400')} />
                {addErr && <p className="mt-1 text-xs text-red-500">{addErr}</p>}
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => { setAddOpen(false); setAddErr(''); }}
                  className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-foreground/70 transition-all hover:bg-accent">取消</button>
                <button onClick={handleAdd} disabled={!addName.trim() || !addUrl.trim()}
                  className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">添加</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
