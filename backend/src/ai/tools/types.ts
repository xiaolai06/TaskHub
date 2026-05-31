// 工具标准接口
export interface ToolDefinition {
  name: string;
  description: string;
  category: 'finance' | 'work' | 'client' | 'goal';
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description?: string; enum?: string[]; default?: unknown }>;
    required?: string[];
  };
  handler: (args: Record<string, unknown>, userId: string) => Promise<unknown>;
  access: 'read' | 'write';
  requiresConfirmation: boolean;
  preferredModel: 'fast' | 'balanced' | 'powerful';
}
