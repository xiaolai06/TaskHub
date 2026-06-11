'use client';

/** 轻量级 Markdown 渲染器 */
export function MarkdownRenderer({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  while (i < lines.length) {
    const line = lines[i];

    // 代码块
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${i}`} className="my-2 overflow-x-auto rounded-lg bg-slate-800 px-3 py-2 text-xs text-emerald-300">
            <code>{codeBuffer.join('\n')}</code>
          </pre>
        );
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      i++; continue;
    }

    if (inCodeBlock) { codeBuffer.push(line); i++; continue; }

    // 空行
    if (!line.trim()) { i++; continue; }

    // 分隔线 --- / *** / ___
    if (/^[-*_]{3,}\s*$/.test(line.trim())) {
      elements.push(<hr key={`hr-${i}`} className="my-3 border-t border-border/40" />);
      i++; continue;
    }

    // 标题 # ~ ###
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const Tag = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
      const cls = level === 1
        ? 'mt-4 mb-2 text-lg font-bold text-foreground'
        : level === 2
          ? 'mt-3 mb-1.5 text-base font-bold text-foreground'
          : 'mt-3 mb-1 text-sm font-semibold text-foreground';
      elements.push(<Tag key={`h-${i}`} className={cls}>{renderInline(text)}</Tag>);
      i++; continue;
    }

    // 中文编号标题：一、二、三、... / （一）/ 1. 标题
    if (/^[一二三四五六七八九十]+[、.．]\s*.+/.test(line) || /^（[一二三四五六七八九十]+）\s*.+/.test(line)) {
      elements.push(<h3 key={`cn-${i}`} className="mt-3 mb-1.5 text-sm font-semibold text-foreground">{renderInline(line)}</h3>);
      i++; continue;
    }

    // 管道表格 | ... |
    if (line.startsWith('|') && line.endsWith('|')) {
      const tableRows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|') && lines[i].endsWith('|')) {
        const cells = lines[i].split('|').filter(c => c.trim()).map(c => c.trim());
        tableRows.push(cells);
        i++;
      }
      if (tableRows.length > 0 && !tableRows[0].every(c => /^[-:]+$/.test(c))) {
        const header = tableRows[0];
        const realBody = tableRows[1] && tableRows[1].every(c => /^[-:]+$/.test(c)) ? tableRows.slice(2) : tableRows.slice(1);
        elements.push(renderTable(`tbl-${i}`, header, realBody));
      }
      continue;
    }

    // 空格/Tab 分隔表格检测：连续 2+ 行都有 2+ 个连续多空格/tab 分隔的列
    if (isSpaceTable(lines, i)) {
      const { header, body, nextI } = parseSpaceTable(lines, i);
      if (header.length >= 2) {
        elements.push(renderTable(`stbl-${i}`, header, body));
      }
      i = nextI;
      continue;
    }

    // 列表项（- 或 *）
    if (/^[\s]*[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[\s]*[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[\s]*[-*]\s/, ''));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-1 space-y-0.5">
          {items.map((item, j) => (
            <li key={j} className="flex items-start gap-2 text-xs text-foreground/80">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 有序列表 1. 2. 3.
    if (/^\d+[.)]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+[.)]\s/, ''));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="my-1 space-y-0.5 list-decimal list-inside">
          {items.map((item, j) => (
            <li key={j} className="text-xs text-foreground/80">{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // 引用块
    if (line.startsWith('> ') || line === '>') {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i].startsWith('> ') || lines[i] === '>')) {
        quoteLines.push(lines[i] === '>' ? '' : lines[i].slice(2));
        i++;
      }
      elements.push(
        <blockquote key={`q-${i}`} className="my-2 border-l-2 border-indigo-300 pl-3 text-xs text-muted-foreground italic">
          {quoteLines.map((q, j) => <p key={j} className={j > 0 ? 'mt-1' : ''}>{renderInline(q)}</p>)}
        </blockquote>
      );
      continue;
    }

    // 普通段落
    elements.push(<p key={`p-${i}`} className="text-xs leading-relaxed text-foreground/80">{renderInline(line)}</p>);
    i++;
  }

  return <>{elements}</>;
}

// ═══ 表格相关工具函数 ═══

/** 渲染表格 */
function renderTable(key: string, header: string[], body: string[][]) {
  return (
    <div key={key} className="my-2 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted">
          <tr>{header.map((h, j) => <th key={j} className="px-3 py-2 font-medium text-foreground/70 border-b">{renderInline(h)}</th>)}</tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} className="border-b last:border-0">{row.map((c, ci) => <td key={ci} className="px-3 py-1.5 text-foreground/80">{renderInline(c)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 检测从 pos 开始是否是空格/Tab 分隔的表格（至少 2 行、每行至少 2 列） */
function isSpaceTable(lines: string[], pos: number): boolean {
  let rowCount = 0;
  let colCount = 0;
  for (let j = pos; j < Math.min(lines.length, pos + 10); j++) {
    const line = lines[j];
    if (!line.trim()) break;
    // 跳过分隔线行（如 ----    ----）
    if (/^[-:=\s]+$/.test(line)) { rowCount++; continue; }
    const cols = splitByColumns(line);
    if (cols.length < 2) break;
    if (colCount === 0) colCount = cols.length;
    // 容许列数 ±1（有些行可能少一列）
    if (Math.abs(cols.length - colCount) > 1) break;
    rowCount++;
  }
  return rowCount >= 2 && colCount >= 2;
}

/** 按连续多空格或 Tab 分割列 */
function splitByColumns(line: string): string[] {
  // 先按 tab 分，再按 2+ 空格分
  return line.split(/\t+|(?:\s{2,})/).map(c => c.trim()).filter(c => c.length > 0);
}

/** 解析空格/Tab 分隔表格 */
function parseSpaceTable(lines: string[], pos: number): { header: string[]; body: string[][]; nextI: number } {
  const rows: string[][] = [];
  let j = pos;
  for (; j < Math.min(lines.length, pos + 20); j++) {
    const line = lines[j];
    if (!line.trim()) break;
    // 跳过纯分隔线行（----    ----）
    if (/^[-:=\s]+$/.test(line)) continue;
    const cols = splitByColumns(line);
    if (cols.length < 2) break;
    rows.push(cols);
  }
  return {
    header: rows[0] || [],
    body: rows.slice(1),
    nextI: j,
  };
}

// ═══ 行内渲染 ═══

/** 归一化 AI 输出中的 Markdown 标记变体 */
function normalizeMarkdown(text: string): string {
  return text
    .replace(/＊/g, '*')
    .replace(/＿/g, '_')
    .replace(/[​‌‍﻿]/g, '')
    .replace(/__(.+?)__/g, '**$1**')
    .replace(/(?<!\w)_(.+?)_(?!\w)/g, '*$1*');
}

/** 安全 URL 检查 */
function isSafeUrl(url: string): boolean {
  try { return ['http:', 'https:', 'mailto:'].includes(new URL(url).protocol); }
  catch { return false; }
}

/** 行内渲染：加粗、斜体、代码、链接 */
function renderInline(rawText: string): React.ReactNode {
  const text = normalizeMarkdown(rawText);
  const parts: Array<{ type: 'text' | 'strong' | 'em' | 'code' | 'link'; text: string; url?: string }> = [];
  let remaining = text;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    const italicMatch = remaining.match(/^\*(.+?)\*/);
    const codeMatch = remaining.match(/^`([^`]+)`/);
    const linkMatch = remaining.match(/^\[(.+?)\]\((.+?)\)/);

    const matches = [
      { m: boldMatch, type: 'strong' as const },
      { m: italicMatch, type: 'em' as const },
      { m: codeMatch, type: 'code' as const },
      { m: linkMatch, type: 'link' as const },
    ].filter(x => x.m);

    if (matches.length > 0) {
      const earliest = matches.reduce((best, cur) =>
        (cur.m!.index ?? Infinity) < (best.m!.index ?? Infinity) ? cur : best
      );
      const m = earliest.m!;
      const prefix = remaining.substring(0, m.index);
      if (prefix) parts.push({ type: 'text', text: prefix });
      if (earliest.type === 'link') {
        parts.push({ type: 'link', text: m[1], url: m[2] });
      } else {
        parts.push({ type: earliest.type, text: m[1] });
      }
      remaining = remaining.substring((m.index ?? 0) + m[0].length);
    } else {
      parts.push({ type: 'text', text: remaining });
      remaining = '';
    }
  }

  return <>{parts.map((p, i) => {
    switch (p.type) {
      case 'strong': return <strong key={i} className="font-semibold text-foreground">{p.text}</strong>;
      case 'em': return <em key={i} className="italic">{p.text}</em>;
      case 'code': return <code key={i} className="rounded bg-muted px-1 py-0.5 text-xs text-rose-600 font-mono">{p.text}</code>;
      case 'link': return isSafeUrl(p.url || '') ? <a key={i} href={p.url} className="text-indigo-500 underline" target="_blank" rel="noreferrer">{p.text}</a> : <span key={i}>{p.text}</span>;
      default: return <span key={i}>{p.text}</span>;
    }
  })}</>;
}
