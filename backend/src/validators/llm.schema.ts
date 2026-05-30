import { z } from 'zod';

export const chatSchema = z.object({
  message: z.string().min(1, '消息不能为空').max(2000, '消息不能超过 2000 字'),
  sessionId: z.string().optional().default('default'),
});

export type ChatInput = z.infer<typeof chatSchema>;
