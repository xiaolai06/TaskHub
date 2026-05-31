import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'taskflow-dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // 加密（AES-256 需要 32 字节密钥）
  encryptionKey: process.env.ENCRYPTION_KEY || 'dev-encryption-key-change-in-prod',

  // 限频
  limitEnabled: process.env.LIMIT_ENABLED !== 'false',
} as const;
