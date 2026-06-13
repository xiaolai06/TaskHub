/**
 * 任务相关的共享工具函数
 * 从 TaskCard / TaskList / TaskDetailSheet / Schedule 中提取
 */

/** 格式化日期为中文短格式 */
export function formatDate(dateStr: string | null | undefined, style: 'short' | 'long' = 'short'): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    day: 'numeric',
  });
}

/** 格式化日期时间（月日 时:分） */
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 将分（fen）转换为元并格式化 */
export function formatCost(fen: number | null | undefined, fallback = '—'): string {
  if (!fen) return fallback;
  const yuan = fen / 100;
  return yuan >= 10000 ? `¥${(yuan / 10000).toFixed(1)}万` : `¥${yuan.toLocaleString()}`;
}

/** 判断是否逾期（可选排除已完成状态） */
export function isOverdue(dateStr: string | null | undefined, excludeDoneStatus?: string): boolean {
  if (!dateStr) return false;
  if (excludeDoneStatus && excludeDoneStatus === 'DONE') return false;
  return new Date(dateStr) < new Date();
}

/** 优先级 → 中文标签 */
export const PRIORITY_LABEL: Record<string, string> = {
  URGENT: '紧急',
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
};

/** 优先级 → 圆点颜色 class */
export const PRIORITY_DOT: Record<string, string> = {
  URGENT: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-amber-400',
  LOW: 'bg-accent',
};
