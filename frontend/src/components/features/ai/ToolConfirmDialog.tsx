'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface ToolConfirmDialogProps {
  toolName: string;
  args: Record<string, unknown>;
  onConfirm: () => void;
  onCancel: () => void;
}

const toolDescriptions: Record<string, string> = {
  create_task: '创建新任务',
  update_task_status: '更新任务状态',
  delete_task: '删除任务',
  create_project: '创建新项目',
  update_project: '更新项目信息',
  create_customer: '创建新客户',
  log_time: '记录工时',
  log_communication: '记录客户沟通',
};

export function ToolConfirmDialog({ toolName, args, onConfirm, onCancel }: ToolConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  const description = toolDescriptions[toolName] || `执行 ${toolName}`;

  return (
    <Card className="border-yellow-200 bg-yellow-50/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-600" />
          确认操作
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          AI 建议执行：<span className="font-medium text-foreground">{description}</span>
        </p>

        {/* 显示关键参数 */}
        <div className="bg-white rounded-lg p-3 text-xs space-y-1 border">
          {Object.entries(args).slice(0, 5).map(([key, value]) => (
            <div key={key} className="flex justify-between">
              <span className="text-muted-foreground">{key}:</span>
              <span className="font-mono">{String(value).substring(0, 50)}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="flex-1"
          >
            <XCircle className="w-4 h-4 mr-1" />
            取消
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1"
          >
            <CheckCircle2 className="w-4 h-4 mr-1" />
            {loading ? '执行中...' : '确认执行'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
