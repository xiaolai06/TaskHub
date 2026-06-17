'use client';

import { TrendingUp, Globe, Code, MessageSquare, Search } from 'lucide-react';
import type { ComponentType } from 'react';

interface SourceMeta {
  icon: ComponentType<{ className?: string }>;
  label: string;
  color: string;
  dotColor: string;
}

export const SOURCE_CONFIG: Record<string, SourceMeta> = {
  github:     { icon: Code,          label: 'GitHub',      color: 'bg-gray-100 text-gray-700',   dotColor: 'bg-gray-400' },
  hackernews: { icon: TrendingUp,    label: 'Hacker News', color: 'bg-orange-100 text-orange-700', dotColor: 'bg-orange-400' },
  devto:      { icon: MessageSquare, label: 'Dev.to',      color: 'bg-indigo-100 text-indigo-600', dotColor: 'bg-indigo-400' },
  duckduckgo: { icon: Globe,         label: 'DuckDuckGo',  color: 'bg-green-100 text-green-700', dotColor: 'bg-green-400' },
  searxng:    { icon: Search,        label: 'SearXNG',     color: 'bg-sky-100 text-sky-700',    dotColor: 'bg-sky-400' },
  sogou:      { icon: Globe,         label: '搜狗',         color: 'bg-yellow-100 text-yellow-700', dotColor: 'bg-yellow-400' },
};

const FALLBACK: SourceMeta = { icon: Globe, label: '', color: 'bg-muted text-foreground/70', dotColor: 'bg-gray-300' };

export function getSourceMeta(source: string): SourceMeta {
  return SOURCE_CONFIG[source] ?? { ...FALLBACK, label: source };
}
