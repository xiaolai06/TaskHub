import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().min(1, '客户名称不能为空').max(100, '客户名称不超过100个字符'),
  email: z.string().email('邮箱格式不正确').optional().or(z.literal('')),
  phone: z.string().max(20, '电话不超过20个字符').optional().or(z.literal('')),
  company: z.string().max(100, '公司名称不超过100个字符').optional().or(z.literal('')),
  address: z.string().max(200, '地址不超过200个字符').optional().or(z.literal('')),
  industry: z.string().max(50, '行业不超过50个字符').optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'VIP', 'INACTIVE', 'LEAD']).optional().default('ACTIVE'),
  notes: z.string().max(1000, '备注不超过1000个字符').optional().or(z.literal('')),
});

export const updateCustomerSchema = z.object({
  name: z.string().min(1, '客户名称不能为空').max(100, '客户名称不超过100个字符').optional(),
  email: z.string().email('邮箱格式不正确').optional().or(z.literal('')),
  phone: z.string().max(20, '电话不超过20个字符').optional().or(z.literal('')),
  company: z.string().max(100, '公司名称不超过100个字符').optional().or(z.literal('')),
  address: z.string().max(200, '地址不超过200个字符').optional().or(z.literal('')),
  industry: z.string().max(50, '行业不超过50个字符').optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'VIP', 'INACTIVE', 'LEAD']).optional(),
  notes: z.string().max(1000, '备注不超过1000个字符').optional().or(z.literal('')),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
