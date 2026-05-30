import dotenv from 'dotenv';
import path from 'path';

// 加载 .env 文件
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function requireEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    console.error(`❌ 缺少必需的环境变量: ${key}`);
    process.exit(1);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: requireEnv('DATABASE_URL'),
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  encryptionKey: requireEnv('ENCRYPTION_KEY'),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  nodeEnv: process.env.NODE_ENV || 'development',
  limitEnabled: process.env.LIMIT_ENABLED !== 'false',
} as const;
