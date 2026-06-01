import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * 确保密钥是 32 字节（AES-256 要求）
 * 如果密钥不足 32 字节，用 SHA-256 hash 扩展
 */
function deriveKey(rawKey: string): Buffer {
  return crypto.createHash('sha256').update(rawKey).digest();
}

/**
 * 加密（AES-256-GCM，带认证标签）
 * 格式：iv:authTag:ciphertext（均为 hex）
 */
export function encrypt(plaintext: string): string {
  const key = deriveKey(config.encryptionKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * 解密（AES-256-GCM，验证认证标签防篡改）
 */
export function decrypt(ciphertext: string): string {
  const key = deriveKey(config.encryptionKey);
  const parts = ciphertext.split(':');

  // 兼容旧格式（iv:encrypted，无 auth tag 的 CBC 格式）
  if (parts.length === 2) {
    return decryptLegacy(key, parts[0], parts[1]);
  }

  // 新格式（iv:authTag:encrypted）
  if (parts.length !== 3) {
    throw new Error('无效的密文格式');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * 兼容旧版 CBC 格式的解密
 */
function decryptLegacy(key: Buffer, ivHex: string, encrypted: string): string {
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
