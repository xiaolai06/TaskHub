import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function requireEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    console.error(`❌ 缺少必需的环境变量: ${key}`);
    process.exit(1);
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue;
}

export const config = {
  // ===== 服务 =====
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'production',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  // ===== 数据库 =====
  databaseUrl: requireEnv('DATABASE_URL'),

  // ===== 认证 =====
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // ===== 加密 =====
  encryptionKey: requireEnv('ENCRYPTION_KEY'),

  // ===== 安全 =====
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  trustProxy: process.env.TRUST_PROXY || '1',

  // ===== 限频 =====
  limitEnabled: process.env.LIMIT_ENABLED !== 'false',

  // ===== 定时任务 =====
  cronEnabled: process.env.CRON_ENABLED !== 'false',

  // ===== AI =====
  ai: {
    provider: optionalEnv('DEFAULT_AI_PROVIDER', 'deepseek'),
    apiKey: optionalEnv('DEFAULT_AI_API_KEY'),
    baseUrl: optionalEnv('DEFAULT_AI_BASE_URL'),
    model: optionalEnv('DEFAULT_AI_MODEL'),
  },

  // ===== n8n =====
  n8n: {
    baseUrl: optionalEnv('N8N_BASE_URL', 'http://localhost:5678'),
    webhookSecret: optionalEnv('N8N_WEBHOOK_SECRET'),
  },

  // ===== 邮件 =====
  smtp: {
    host: optionalEnv('SMTP_HOST'),
    port: parseInt(optionalEnv('SMTP_PORT', '587'), 10),
    user: optionalEnv('SMTP_USER'),
    pass: optionalEnv('SMTP_PASS'),
  },
} as const;
