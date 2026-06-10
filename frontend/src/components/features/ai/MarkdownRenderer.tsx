'use client';

import { cn } from '@/lib/utils';

/** 轻量级 Markdown 渲染器 */
export function MarkdownRenderer({ content }: { content: string }) {
  if (!content) return null;

  // 拆分成行
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLang = '';

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
        codeLang = line.slice(3).trim();
      }
      i++; continue;
    }

    if (inCodeBlock) { codeBuffer.push(line); i++; continue; }

    // 空行
    if (!line.trim()) { i++; continue; }

    // 标题
    if (line.startsWith('### ')) {
      elements.push(<h3 key={`h-${i}`} className="mt-3 mb-1 text-sm font-semibold text-foreground">{renderInline(line.slice(4))}</h3>);
      i++; continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<h2 key={`h-${i}`} className="mt-3 mb-1 text-base font-bold text-foreground">{renderInline(line.slice(3))}</h2>);
      i++; continue;
    }

    // 表格
    if (line.startsWith('|') && line.endsWith('|')) {
      const tableRows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|') && lines[i].endsWith('|')) {
        const cells = lines[i].split('|').filter(c => c.trim()).map(c => c.trim());
        tableRows.push(cells);
        i++;
      }
      if (tableRows.length > 0 && !tableRows[0].every(c => /^[-:]+$/.test(c))) {
        const header = tableRows[0];
        const body = tableRows.filter((_, idx) => idx !== 1 || !tableRows[1]?.every(c => /^[-:]+$/.test(c)));
        const realBody = tableRows[1] && tableRows[1].every(c => /^[-:]+$/.test(c)) ? tableRows.slice(2) : tableRows.slice(1);
        elements.push(
          <div key={`tbl-${i}`} className="my-2 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted">
                <tr>{header.map((h, j) => <th key={j} className="px-3 py-2 font-medium text-foreground/70 border-b">{renderInline(h)}</th>)}</tr>
              </thead>
              <tbody>
                {realBody.map((row, ri) => (
                  <tr key={ri} className="border-b last:border-0">{row.map((c, ci) => <td key={ci} className="px-3 py-1.5 text-foreground/80">{renderInline(c)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // 列表项
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

    // 引用块
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
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

/** 安全 URL 检查：只允许 http/https/mailto 协议 */
function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return ['http:', 'https:', 'mailto:'].includes(u.protocol);
  } catch {
    return false;
  }
}

/** 行内渲染：加粗、斜体、代码、链接 */
function renderInline(text: string): React.ReactNode {
  // 简化处理：使用安全的文本渲染，不注入 HTML
  const parts: Array<{ type: 'text' | 'strong' | 'em' | 'code' | 'link'; text: string; url?: string }> = [];
  let remaining = text;

  // 逐个提取 token
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
