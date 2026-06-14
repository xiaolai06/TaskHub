declare module 'pdf-parse' {
  interface PDFParseResult {
    text: string;
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    version: string;
  }

  interface TextResult {
    pages: Array<{ text: string; num: number }>;
    text: string;
    total: number;
  }

  interface PDFParseOptions {
    data: Buffer;
    verbosity?: number;
  }

  class PDFParse {
    constructor(options: PDFParseOptions);
    load(): Promise<void>;
    getText(): Promise<TextResult>;
    destroy(): Promise<void>;
  }

  export { PDFParse, PDFParseResult, TextResult, PDFParseOptions };
  export default function pdfParse(buffer: Buffer): Promise<PDFParseResult>;
}
