import sharp from 'sharp';
import { AppError } from '../utils/errors';

/**
 * 文件预处理层
 * 图片 → sharp 压缩 → base64（发给多模态模型）
 * PDF  → pdf-parse 提取文字
 * Word → mammoth 提取文字
 * Excel → xlsx 提取表格数据
 * TXT  → 直接读取 UTF-8 文本
 */

// 允许的图片类型
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// 允许的文档类型
const DOC_MIME_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word (.docx)',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel (.xlsx)',
  'text/plain': '文本 (.txt)',
};

// 全部允许的类型
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...Object.keys(DOC_MIME_TYPES)];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// 图片压缩配置
const IMAGE_MAX_WIDTH = 1568;
const IMAGE_QUALITY = 80;

// 文本截取阈值
const TEXT_TOKEN_LIMIT = 3000;
const TEXT_TRUNCATE_RATIO = 0.6;

type FileType = 'image' | 'pdf_text' | 'docx_text' | 'xlsx_text' | 'plain_text';

interface ProcessedFile {
  type: FileType;
  fileName: string;
  fileSize: number;
  compressedSize?: number;
  base64?: string;
  mimeType?: string;
  text?: string;
}

interface FileMessage {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

// ═══ 文件类型描述（用于错误提示）═══

const SUPPORTED_FORMATS = '图片 (JPG/PNG/WebP/GIF)、PDF、Word (.docx)、Excel (.xlsx)、文本 (.txt)';

/**
 * 校验文件类型是否支持
 */
function validateFileType(file: Express.Multer.File): void {
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    // 根据扩展名给出更友好的提示
    const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
    const hintMap: Record<string, string> = {
      doc: '旧版 .doc 格式不支持，请另存为 .docx 后重新上传',
      xls: '旧版 .xls 格式不支持，请另存为 .xlsx 后重新上传',
      csv: 'CSV 暂不支持，建议保存为 .xlsx 或 .txt 后上传',
      ppt: 'PowerPoint 暂不支持',
      pptx: 'PowerPoint 暂不支持',
      pdf: 'PDF 文件 MIME 类型异常，请确认文件未损坏',
    };
    const hint = hintMap[ext] || `不支持的文件格式`;
    throw new AppError(
      `${hint}。当前支持：${SUPPORTED_FORMATS}`,
      400,
      'INVALID_FILE_TYPE',
    );
  }
}

/**
 * 处理上传的文件
 */
export async function processFiles(
  files: Express.Multer.File[],
): Promise<ProcessedFile[]> {
  const results: ProcessedFile[] = [];

  for (const file of files) {
    // 类型校验
    validateFileType(file);

    // 大小校验
    if (file.size > MAX_FILE_SIZE) {
      throw new AppError(
        `文件 ${file.originalname} 超过 20MB 限制（当前 ${(file.size / 1024 / 1024).toFixed(1)}MB）`,
        400,
        'FILE_TOO_LARGE',
      );
    }

    const mime = file.mimetype;

    if (ALLOWED_IMAGE_TYPES.includes(mime)) {
      // 图片：sharp 压缩 → WebP → base64
      const { base64, compressedSize } = await compressImage(file.buffer, file.size);
      results.push({
        type: 'image',
        fileName: file.originalname,
        fileSize: file.size,
        compressedSize,
        base64,
        mimeType: 'image/webp',
      });

    } else if (mime === 'application/pdf') {
      // PDF：提取文字
      const text = await extractPdfText(file.buffer);
      results.push({
        type: 'pdf_text',
        fileName: file.originalname,
        fileSize: file.size,
        text,
      });

    } else if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // Word .docx
      const text = await extractDocxText(file.buffer);
      results.push({
        type: 'docx_text',
        fileName: file.originalname,
        fileSize: file.size,
        text,
      });

    } else if (mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      // Excel .xlsx
      const text = await extractExcelText(file.buffer);
      results.push({
        type: 'xlsx_text',
        fileName: file.originalname,
        fileSize: file.size,
        text,
      });

    } else if (mime === 'text/plain') {
      // 纯文本
      const text = extractPlainText(file.buffer);
      results.push({
        type: 'plain_text',
        fileName: file.originalname,
        fileSize: file.size,
        text,
      });
    }
  }

  return results;
}

// ═══ 图片压缩 ═══

async function compressImage(
  buffer: Buffer,
  originalSize: number,
): Promise<{ base64: string; compressedSize: number }> {
  try {
    const compressed = await sharp(buffer)
      .resize(IMAGE_MAX_WIDTH, IMAGE_MAX_WIDTH, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: IMAGE_QUALITY })
      .toBuffer();

    const ratio = ((1 - compressed.length / originalSize) * 100).toFixed(0);
    console.log(`[FileProcess] 图片压缩: ${(originalSize / 1024).toFixed(0)}KB → ${(compressed.length / 1024).toFixed(0)}KB (压缩 ${ratio}%)`);

    return {
      base64: compressed.toString('base64'),
      compressedSize: compressed.length,
    };
  } catch (err) {
    console.warn('[FileProcess] 图片压缩失败，使用原图:', err);
    return {
      base64: buffer.toString('base64'),
      compressedSize: originalSize,
    };
  }
}

// ═══ PDF 提取文字 ═══

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const pdfParseModule = await import('pdf-parse');
    let text: string;
    let numpages: number;

    const PDFParseClass = pdfParseModule.PDFParse;
    if (PDFParseClass) {
      const parser = new PDFParseClass({ data: buffer });
      await parser.load();
      const result = await parser.getText();
      text = result.text;
      numpages = result.total ?? result.pages?.length ?? 1;
    } else {
      const data = await pdfParseModule.default(buffer);
      text = data.text;
      numpages = data.numpages;
    }

    return truncateText(text, numpages, 'PDF');
  } catch (err) {
    console.error('[FileProcess] PDF 解析失败:', err);
    return '[PDF 解析失败，请确认文件未损坏或不是扫描型 PDF]';
  }
}

// ═══ Word .docx 提取文字 ═══

async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;

    if (result.messages.length > 0) {
      console.warn('[FileProcess] Word 解析警告:', result.messages.slice(0, 3));
    }

    if (!text || text.trim().length < 10) {
      return '[Word 文件内容为空或过少，可能是加密或格式异常]';
    }

    return truncateText(text, 1, 'Word');
  } catch (err) {
    console.error('[FileProcess] Word 解析失败:', err);
    return '[Word 解析失败，请确认文件未损坏且为 .docx 格式]';
  }
}

// ═══ Excel .xlsx 提取表格 ═══

async function extractExcelText(buffer: Buffer): Promise<string> {
  try {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return '[Excel 文件没有工作表]';
    }

    const parts: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      // 转为二维数组
      const rows: string[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
        raw: false,
      });

      if (rows.length === 0) {
        parts.push(`[Sheet: ${sheetName}] (空表)`);
        continue;
      }

      // 过滤全空行
      const nonEmpty = rows.filter(row => row.some(cell => cell !== ''));
      if (nonEmpty.length === 0) {
        parts.push(`[Sheet: ${sheetName}] (空表)`);
        continue;
      }

      // 输出为 Markdown 表格格式
      const header = nonEmpty[0];
      const dataRows = nonEmpty.slice(1);

      parts.push(`[Sheet: ${sheetName}] (${nonEmpty.length} 行)`);
      parts.push(header.join(' | '));
      parts.push(header.map(() => '---').join(' | '));
      for (const row of dataRows) {
        // 对齐列数
        const aligned = header.map((_, i) => row[i] || '');
        parts.push(aligned.join(' | '));
      }
    }

    const fullText = parts.join('\n');
    return truncateText(fullText, workbook.SheetNames.length, 'Excel');
  } catch (err) {
    console.error('[FileProcess] Excel 解析失败:', err);
    return '[Excel 解析失败，请确认文件未损坏且为 .xlsx 格式]';
  }
}

// ═══ TXT 纯文本 ═══

function extractPlainText(buffer: Buffer): string {
  try {
    const text = buffer.toString('utf-8');

    if (!text || text.trim().length < 5) {
      return '[文本文件内容为空]';
    }

    return truncateText(text, 1, 'TXT');
  } catch (err) {
    console.error('[FileProcess] 文本读取失败:', err);
    return '[文本文件读取失败，请确认文件编码为 UTF-8]';
  }
}

// ═══ 通用文本截取 ═══

function truncateText(fullTextRaw: string, pageCount: number, format: string): string {
  const fullText = fullTextRaw.trim();

  if (fullText.length < 20) {
    return `[${format} 文件内容过少]`;
  }

  const estimatedTokens = Math.ceil(fullText.length / 2);
  if (estimatedTokens <= TEXT_TOKEN_LIMIT) return fullText;

  const truncated = fullText.slice(0, Math.floor(fullText.length * TEXT_TRUNCATE_RATIO));
  return `${truncated}\n\n[文件内容较长，已截取前 ${Math.round(TEXT_TRUNCATE_RATIO * 100)}%，原文约 ${estimatedTokens} tokens，${pageCount > 1 ? pageCount + ' 页' : ''}]`;
}

// ═══ 构建多模态消息内容 ═══

export function buildMultimodalContent(
  text: string,
  files: ProcessedFile[],
): string | FileMessage[] {
  if (files.length === 0) return text;

  const content: FileMessage[] = [];

  // 图片走视觉通道
  for (const f of files) {
    if (f.type === 'image' && f.base64 && f.mimeType) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:${f.mimeType};base64,${f.base64}` },
      });
    }
  }

  // 文字类文件（PDF/Word/Excel/TXT）拼接到文本
  const textTypes: FileType[] = ['pdf_text', 'docx_text', 'xlsx_text', 'plain_text'];
  let fullText = text;

  for (const f of files) {
    if (textTypes.includes(f.type) && f.text) {
      fullText += `\n\n--- 上传的文件: ${f.fileName} ---\n${f.text}\n--- 文件内容结束 ---`;
    }
  }

  content.push({ type: 'text', text: fullText });

  return content;
}

// ═══ 构建附件记录（存入数据库）═══

export function buildAttachmentMeta(files: ProcessedFile[]): string {
  return JSON.stringify(files.map(f => ({
    type: f.type,
    fileName: f.fileName,
    fileSize: f.fileSize,
  })));
}
