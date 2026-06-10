import { z } from 'zod';

// 工具标准接口
export interface ToolDefinition {
  name: string;
  description: string;
  category: 'finance' | 'work' | 'client' | 'goal' | 'schedule';
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description?: string; enum?: string[]; default?: unknown }>;
    required?: string[];
  };
  handler: (args: Record<string, unknown>, userId: string) => Promise<unknown>;
  access: 'read' | 'write';
  requiresConfirmation: boolean;
  preferredModel: 'fast' | 'balanced' | 'powerful';
  /** 可选的 Zod schema，用于校验工具参数 */
  schema?: z.ZodType<Record<string, unknown>>;
}
