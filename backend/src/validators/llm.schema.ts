import { z } from 'zod';

export const chatSchema = z.object({
  message: z.string().min(1, '消息不能为空').max(2000, '消息不能超过 2000 字'),
  sessionId: z.string().optional().default('default'),
  conversationSessionId: z.string().optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
});

export type ChatInput = z.infer<typeof chatSchema>;

// 文件上传专用 schema（message 可为空，仅上传文件时）
export const uploadChatSchema = z.object({
  message: z.string().max(2000, '消息不能超过 2000 字').optional().default(''),
  conversationSessionId: z.string().min(1, '会话 ID 不能为空').optional(),
  model: z.string().max(100).optional(),
  provider: z.string().max(50).optional(),
});

export type UploadChatInput = z.infer<typeof uploadChatSchema>;

export const updateSessionSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(50, '标题不能超过 50 字').optional(),
  isPinned: z.boolean().optional(),
});

export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
