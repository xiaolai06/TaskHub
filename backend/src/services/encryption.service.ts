import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-cbc';

export class EncryptionService {
  /** AES-256 加密 */
  static encrypt(text: string): string {
    const key = Buffer.from(config.encryptionKey, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    // IV + 密文拼接，方便解密时提取
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /** AES-256 解密 */
  static decrypt(encryptedText: string): string {
    const key = Buffer.from(config.encryptionKey, 'hex');
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /** 验证密钥是否合法（32 字节 hex = 64 字符） */
  static validateKey(): boolean {
    const key = config.encryptionKey;
    return typeof key === 'string' && /^[0-9a-f]{64}$/i.test(key);
  }
}
