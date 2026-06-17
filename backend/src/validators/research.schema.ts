import { z } from 'zod';

// 收藏研究校验
export const saveResearchSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(300),
  summary: z.string().min(1, '摘要不能为空'),
  content: z.string().min(1, '内容不能为空'),
  tags: z.string().optional(),
  searchResultId: z.string().optional(),
});

export type SaveResearchInput = z.infer<typeof saveResearchSchema>;

// 生成简报校验
export const createBriefingSchema = z.object({
  mode: z.enum(['manual', 'search']).default('manual'),
  query: z.string().optional(),
  items: z.array(z.object({
    title: z.string(),
    snippet: z.string(),
    source: z.string(),
    url: z.string().optional(),
  })).max(20).optional(),
});

export type CreateBriefingInput = z.infer<typeof createBriefingSchema>;

// 简报列表查询校验
export const listBriefingsSchema = z.object({
  mode: z.enum(['manual', 'search']).optional(),
  tag: z.string().optional(),
  saved: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type ListBriefingsInput = z.infer<typeof listBriefingsSchema>;
