import { z } from 'zod';

export const searchQuerySchema = z.object({
  query: z.string().min(1, '搜索关键词不能为空').max(500, '搜索关键词不超过500个字符'),
  source: z.string().max(50).optional(),
});

export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
