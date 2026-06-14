import { z } from 'zod';

// 工具标准接口
export interface ToolDefinition {
  name: string;
  description: string;
  category: 'finance' | 'work' | 'client' | 'goal' | 'schedule' | 'search' | 'info' | 'system' | 'notification' | 'transaction' | 'payment' | 'report' | 'dashboard' | 'subscription' | 'work_timer';
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description?: string; enum?: string[]; default?: unknown }>;
    required?: string[];
  };
  handler: (args: Record<string, unknown>, userId: string) => Promise<unknown>;
  access: 'read' | 'write';
  requiresConfirmation: boolean;
  /** 预期模型级别（目前未启用，保留供未来按工具选模型） */
  preferredModel?: 'fast' | 'balanced' | 'powerful';
  /** 可选的 Zod schema，用于校验工具参数 */
  schema?: z.ZodType<Record<string, unknown>>;
}
