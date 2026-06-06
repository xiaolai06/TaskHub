import fs from 'fs';
import path from 'path';

const PROMPT_DIR = path.resolve(__dirname, '../../prompts');

const promptCache = new Map<string, string>();

/**
 * 从 prompts/ 目录加载提示词文件
 * @param filename 文件名（如 'system-morning.txt'）
 * @param fallback 加载失败时的兜底内容
 */
export function loadPrompt(filename: string, fallback = ''): string {
  if (promptCache.has(filename)) return promptCache.get(filename)!;
  try {
    const content = fs.readFileSync(path.join(PROMPT_DIR, filename), 'utf-8');
    promptCache.set(filename, content);
    return content;
  } catch {
    console.warn(`[loadPrompt] 文件 ${filename} 未找到，使用兜底内容`);
    return fallback;
  }
}
