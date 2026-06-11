import { z } from 'zod';

export const chatSchema = z.object({
  message: z.string().min(1, '消息不能为空').max(2000, '消息不能超过 2000 字'),
  sessionId: z.string().optional().default('default'),
  conversationSessionId: z.string().optional(),  // 新：关联 ConversationSession
  model: z.string().optional(),
  provider: z.string().optional(),
});

export type ChatInput = z.infer<typeof chatSchema>;

export const updateSessionSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(50, '标题不能超过 50 字').optional(),
  isPinned: z.boolean().optional(),
});

export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
