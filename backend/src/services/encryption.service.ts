import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * 确保密钥是 32 字节（AES-256 要求）
 * 如果密钥不足 32 字节，用 SHA-256 hash 扩展
 */
function deriveKey(rawKey: string): Buffer {
  return crypto.createHash('sha256').update(rawKey).digest();
}

/**
 * 加密
 */
export function encrypt(plaintext: string): string {
  const key = deriveKey(config.encryptionKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // 格式：iv:encrypted
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * 解密
 */
export function decrypt(ciphertext: string): string {
  const key = deriveKey(config.encryptionKey);
  const parts = ciphertext.split(':');
  if (parts.length !== 2) {
    throw new Error('无效的密文格式');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
