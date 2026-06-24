'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle } from 'lucide-react';

export function IntegrationTab() {
  const [n8nWebhook, setN8nWebhook] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<Record<string, string>>('/settings/integration')
      .then((res) => {
        if (res.n8n_webhook) setN8nWebhook(res.n8n_webhook);
      })
      .catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await api.post('/settings/batch', {
        settings: [
          { category: 'INTEGRATION', key: 'n8n_webhook', value: n8nWebhook },
          { category: 'INTEGRATION', key: 'webhook_secret', value: webhookSecret, encrypted: true },
        ],
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {} finally { setSaving(false); }
  }

  const inputCls = 'w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60';

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground/80">n8n Webhook 地址</label>
        <input type="url" value={n8nWebhook} onChange={(e) => setN8nWebhook(e.target.value)}
          placeholder="https://n8n.example.com/webhook/xxx" className={inputCls} />
        <p className="mt-1 text-2xs-plus text-muted-foreground">n8n 自动化工作流的回调地址</p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground/80">Webhook 密钥</label>
        <input type="password" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)}
          placeholder="用于验证 Webhook 来源" className={inputCls} />
      </div>

      {saved && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
          <CheckCircle className="h-4 w-4" />配置已保存
        </div>
      )}

      <button onClick={handleSave} disabled={saving}
        className="flex h-10 items-center gap-1.5 rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white transition-all hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
        保存配置
      </button>
    </div>
  );
}
