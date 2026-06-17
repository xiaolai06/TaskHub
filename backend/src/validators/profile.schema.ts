import { z } from 'zod';

export const updateProfileSchema = z.object({
  bio: z.string().max(500, '简介不超过500个字符').optional(),
  birthday: z.string().refine(d => !d || !isNaN(Date.parse(d)), '日期格式无效').optional(),
  zodiac: z.string().max(20, '星座不超过20个字符').optional(),
  mbti: z.string().max(10, 'MBTI不超过10个字符').optional(),
  phone: z.string().max(20, '手机号不超过20个字符').optional(),
  location: z.string().max(100, '地址不超过100个字符').optional(),
  company: z.string().max(100, '公司不超过100个字符').optional(),
  title: z.string().max(50, '职位不超过50个字符').optional(),
  website: z.string().url('网站格式不正确').or(z.literal('')).optional(),
  tags: z.array(z.string().max(30)).max(10, '最多10个标签').optional(),
  avatarType: z.enum(['initial', 'emoji', 'upload', 'url']).optional(),
  avatarValue: z.string().max(500).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
